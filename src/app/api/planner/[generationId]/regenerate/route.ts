import { NextRequest, NextResponse } from "next/server";
import { getOrCreateSession, setSessionCookie } from "@/lib/session/anonymous";
import { getDb } from "@/lib/db/schema";
import { verifyEntitlement } from "@/lib/entitlement/check";
import { generateSingleActivity } from "@/lib/generation/pipeline";
import { PlannerPreferences, WeeklyPlanner, MonthlyPlanner, PlannedActivity } from "@/lib/schemas/preferences";
import { rateLimitMiddleware } from "@/lib/rateLimit/rateLimiter";
import { verifyGenerationToken } from "@/lib/session/generationToken";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ generationId: string }> }
) {
  try {
    const { sessionId, token } = await getOrCreateSession();
    const { generationId } = await params;

    // Rate limiting check
    const rateLimit = rateLimitMiddleware(sessionId, "activityRegenerations");
    if (rateLimit) {
      return NextResponse.json(rateLimit.json, { status: rateLimit.status });
    }

    const body = await request.json();
    const { dayNumber, weekNumber = 1, activityIndex = 0, currentTitle, currentMechanic,
      preferences: bodyPreferences, planner: bodyPlanner, generationToken } = body as {
      dayNumber: number;
      weekNumber?: number;
      activityIndex?: number;
      currentTitle?: string;
      currentMechanic?: string;
      preferences?: PlannerPreferences;
      planner?: WeeklyPlanner | MonthlyPlanner;
      generationToken?: string;
    };

    if (!dayNumber) {
      return NextResponse.json({ error: "dayNumber is required" }, { status: 400 });
    }

    // Verify entitlement if user is accessing full planner
    const isDemoMode = process.env.DEMO_MODE !== "false" || !process.env.STRIPE_SECRET_KEY;
    const tokenValid = Boolean(generationToken && verifyGenerationToken(generationId, generationToken));

    const db = getDb();
    const generation = db
      .prepare("SELECT preferences, full_data, product_type FROM planner_generations WHERE id = ? AND session_id = ?")
      .get(generationId, sessionId) as {
        preferences: string;
        full_data: string | null;
        product_type: string;
      } | undefined;

    if ((!generation || !generation.full_data) && (!tokenValid || !bodyPreferences || !bodyPlanner)) {
      return NextResponse.json({ error: "Planner not found" }, { status: 404 });
    }

    const entitlement = verifyEntitlement(sessionId, generationId);
    if (!isDemoMode && !entitlement && !tokenValid) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const preferences: PlannerPreferences = generation ? JSON.parse(generation.preferences) : bodyPreferences!;

    // Extract ALL existing titles and mechanics in the current plan to prevent duplication
    const existingTitles: string[] = [];
    const existingMechanics: string[] = [];

    const sourcePlanner = generation?.full_data ? JSON.parse(generation.full_data) as WeeklyPlanner | MonthlyPlanner : bodyPlanner!;
    const sourceProductType = generation?.product_type || ("days" in sourcePlanner ? "weekly" : "monthly");
    if (sourceProductType === "weekly") {
      const weekly = sourcePlanner as WeeklyPlanner;
      for (const d of weekly.days) {
        for (const act of d.activities) {
          if (act.title) existingTitles.push(act.title);
          if (act.noveltySignature) existingMechanics.push(act.noveltySignature);
        }
      }
    } else if (sourceProductType === "monthly") {
      const monthly = sourcePlanner as MonthlyPlanner;
      for (const w of monthly.weeks) {
        for (const d of w.days) {
          for (const act of d.activities) {
            if (act.title) existingTitles.push(act.title);
            if (act.noveltySignature) existingMechanics.push(act.noveltySignature);
          }
        }
      }
    }

    if (currentTitle && !existingTitles.includes(currentTitle)) {
      existingTitles.push(currentTitle);
    }
    if (currentMechanic && !existingMechanics.includes(currentMechanic)) {
      existingMechanics.push(currentMechanic);
    }

    const targetDomain = preferences.goals[(dayNumber + activityIndex - 1) % (preferences.goals.length || 1)] || "creativity";

    // Generate new activity preserving all original constraints and excluding all in-plan activities
    let newActivity = await generateSingleActivity({
      sessionId,
      preferences,
      dayNumber,
      activityIndex,
      targetDomain,
      excludeTitle: currentTitle,
      excludeTitles: currentTitle ? [currentTitle] : [],
      excludeMechanic: currentMechanic,
      excludeMechanics: sourceProductType === "weekly" ? existingMechanics : undefined,
      // A replacement should be immediate and predictable. The deterministic
      // engine already enforces the same age, material, safety, and novelty
      // gates without waiting on repeated external-model retries.
      forceDeterministic: true,
      // The current plan is supplied explicitly below. Session-history novelty
      // would reject every reusable monthly archetype and cause seven needless
      // retries before returning the unchanged activity.
      skipSessionNovelty: true,
    });

    // Plan-wide novelty verification. Never return an activity that already
    // appears elsewhere in the current plan.
    let noveltyAttempts = 0;
    const hasExactTitle = (title: string) => existingTitles.some(
      (existing) => existing.trim().toLowerCase() === title.trim().toLowerCase()
    );
    while (hasExactTitle(newActivity.title) && noveltyAttempts < 7) {
      const rejectedTitle = newActivity.title;
      const rejectedMechanic = newActivity.noveltySignature?.split(":")[0];
      noveltyAttempts += 1;
      newActivity = await generateSingleActivity({
        sessionId,
        preferences,
        dayNumber: dayNumber + noveltyAttempts,
        activityIndex,
        targetDomain,
        excludeTitle: rejectedTitle,
        excludeTitles: [currentTitle, rejectedTitle].filter((title): title is string => Boolean(title)),
        excludeMechanic: rejectedMechanic || currentMechanic,
        excludeMechanics: sourceProductType === "weekly"
          ? [...existingMechanics, ...(rejectedMechanic ? [rejectedMechanic] : [])]
          : undefined,
        forceDeterministic: true,
        skipSessionNovelty: true,
      });
    }

    if (hasExactTitle(newActivity.title)) {
      return NextResponse.json(
        { error: "Could not find a sufficiently different activity. Please try again." },
        { status: 409 }
      );
    }

    // Update in database planner_activities
    db.prepare(`
      INSERT OR REPLACE INTO planner_activities (
        id, generation_id, week_number, day_number, activity_index, activity_data, novelty_signature
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      newActivity.id,
      generationId,
      weekNumber,
      dayNumber,
      activityIndex,
      JSON.stringify(newActivity),
      newActivity.noveltySignature
    );

    // Update full_data in planner_generations
    if (generation && generation.product_type === "weekly") {
      const weekly: WeeklyPlanner = JSON.parse(generation.full_data!);
      const day = weekly.days.find((d) => d.dayNumber === dayNumber);
      if (day) {
        day.activities[activityIndex] = newActivity;
        db.prepare("UPDATE planner_generations SET full_data = ? WHERE id = ?").run(
          JSON.stringify(weekly),
          generationId
        );
      }
    } else if (generation && generation.product_type === "monthly") {
      const monthly: MonthlyPlanner = JSON.parse(generation.full_data!);
      const week = monthly.weeks.find((w) => w.weekNumber === weekNumber);
      const day = week?.days.find((d) => d.dayNumber === dayNumber);
      if (day) {
        day.activities[activityIndex] = newActivity;
        db.prepare("UPDATE planner_generations SET full_data = ? WHERE id = ?").run(
          JSON.stringify(monthly),
          generationId
        );
      }
    }

    db.prepare("INSERT INTO analytics_events (event_type, product_type) VALUES ('regenerate_activity', ?)").run(
      sourceProductType
    );

    const response = NextResponse.json({
      success: true,
      activity: newActivity,
    });
    if (token) setSessionCookie(response, token);
    return response;
  } catch (err: unknown) {
    console.error("[Regenerate Activity Error]:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to regenerate activity" },
      { status: 500 }
    );
  }
}
