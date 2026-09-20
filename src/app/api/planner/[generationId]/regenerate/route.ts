import { NextRequest, NextResponse } from "next/server";
import { getOrCreateSession } from "@/lib/session/anonymous";
import { getDb } from "@/lib/db/schema";
import { verifyEntitlement } from "@/lib/entitlement/check";
import { generateSingleActivity } from "@/lib/generation/pipeline";
import { PlannerPreferences, WeeklyPlanner, MonthlyPlanner } from "@/lib/schemas/preferences";
import { rateLimitMiddleware } from "@/lib/rateLimit/rateLimiter";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ generationId: string }> }
) {
  try {
    const { sessionId } = await getOrCreateSession();
    const { generationId } = await params;

    // Rate limiting check
    const rateLimit = rateLimitMiddleware(sessionId, "activityRegenerations");
    if (rateLimit) {
      return NextResponse.json(rateLimit.json, { status: rateLimit.status });
    }

    const body = await request.json();
    const { dayNumber, weekNumber = 1, activityIndex = 0, currentTitle, currentMechanic } = body as {
      dayNumber: number;
      weekNumber?: number;
      activityIndex?: number;
      currentTitle?: string;
      currentMechanic?: string;
    };

    if (!dayNumber) {
      return NextResponse.json({ error: "dayNumber is required" }, { status: 400 });
    }

    // Verify entitlement if user is accessing full planner
    const entitlement = verifyEntitlement(sessionId, generationId);
    if (!entitlement && dayNumber > 1) {
      return NextResponse.json({ error: "Purchase required to regenerate locked days" }, { status: 403 });
    }

    const db = getDb();
    const generation = db
      .prepare("SELECT preferences, full_data, product_type FROM planner_generations WHERE id = ? AND session_id = ?")
      .get(generationId, sessionId) as {
        preferences: string;
        full_data: string | null;
        product_type: string;
      } | undefined;

    if (!generation || !generation.full_data) {
      return NextResponse.json({ error: "Planner not found" }, { status: 404 });
    }

    const preferences: PlannerPreferences = JSON.parse(generation.preferences);

    // Generate new activity preserving all original constraints
    // Exclude the current title and mechanic so the regenerated activity is genuinely different
    const newActivity = await generateSingleActivity({
      sessionId,
      preferences,
      dayNumber,
      activityIndex,
      excludeTitle: currentTitle,
      excludeMechanic: currentMechanic,
    });

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
    if (generation.product_type === "weekly") {
      const weekly: WeeklyPlanner = JSON.parse(generation.full_data);
      const day = weekly.days.find((d) => d.dayNumber === dayNumber);
      if (day) {
        day.activities[activityIndex] = newActivity;
        db.prepare("UPDATE planner_generations SET full_data = ? WHERE id = ?").run(
          JSON.stringify(weekly),
          generationId
        );
      }
    } else if (generation.product_type === "monthly") {
      const monthly: MonthlyPlanner = JSON.parse(generation.full_data);
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
      generation.product_type
    );

    return NextResponse.json({
      success: true,
      activity: newActivity,
    });
  } catch (err: unknown) {
    console.error("[Regenerate Activity Error]:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to regenerate activity" },
      { status: 500 }
    );
  }
}
