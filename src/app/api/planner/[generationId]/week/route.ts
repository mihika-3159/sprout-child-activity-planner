import { NextRequest, NextResponse } from "next/server";
import { getOrCreateSession, setSessionCookie } from "@/lib/session/anonymous";
import { verifyGenerationToken } from "@/lib/session/generationToken";
import { getDb } from "@/lib/db/schema";
import { PlannerPreferences, PlannedActivity, MonthlyPlanner } from "@/lib/schemas/preferences";
import { generateSingleActivity } from "@/lib/generation/pipeline";

const WEEKLY_THEMES = [
  "Exploration & Discovery",
  "Story & Imagination",
  "Building & Engineering",
  "Nature & Observation",
];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ generationId: string }> }
) {
  // Safely obtain session — if SESSION_SECRET is missing in env this throws, so we catch it
  let sessionId = "";
  let token = "";
  try {
    const sess = await getOrCreateSession();
    sessionId = sess.sessionId;
    token = sess.token;
  } catch {
    // Session secret not configured — fall through to token-based auth only
  }

  try {
    const { generationId } = await params;

    const body = await request.json();
    const { weekNumber, preferences: bodyPreferences, existingTitles = [], existingMechanics = [] } = body as {
      weekNumber: number;
      preferences?: PlannerPreferences;
      existingTitles?: string[];
      existingMechanics?: string[];
    };

    if (!weekNumber || weekNumber < 1 || weekNumber > 4) {
      return NextResponse.json({ error: "weekNumber must be 1–4" }, { status: 400 });
    }

    const db = getDb();
    const genTokenHeader = request.headers.get("x-generation-token");
    const genTokenQuery = request.nextUrl.searchParams.get("token");
    const passedToken = genTokenHeader || genTokenQuery;
    const isTokenValid = Boolean(passedToken && verifyGenerationToken(generationId, passedToken));
    const generation = db
      .prepare("SELECT preferences, full_data, product_type, session_id FROM planner_generations WHERE id = ?")
      .get(generationId) as {
        preferences: string;
        full_data: string | null;
        product_type: string;
        session_id: string;
      } | undefined;

    if (!generation && (!isTokenValid || !bodyPreferences)) {
      return NextResponse.json({ error: "Generation not found" }, { status: 404 });
    }

    // Auth: demo mode bypasses all auth (consistent with GET /planner/[generationId])
    const isDemoMode = process.env.DEMO_MODE !== "false" || !process.env.STRIPE_SECRET_KEY;

    // Accept token from header OR query param (consistent with GET route)
    const isOwner = Boolean(sessionId && generation?.session_id === sessionId);

    if (!isDemoMode && !isOwner && !isTokenValid) {
      return NextResponse.json(
        { error: "Unauthorised" },
        { status: 401 }
      );
    }

    if (generation && generation.product_type !== "monthly") {
      return NextResponse.json({ error: "This endpoint is for monthly plans only" }, { status: 400 });
    }

    const preferences: PlannerPreferences = generation ? JSON.parse(generation.preferences) : bodyPreferences!;
    const theme = WEEKLY_THEMES[weekNumber - 1];

    // Stateless path: Vercel's /tmp storage is not shared between function invocations.
    // A signed generation token plus validated preferences lets each week stand alone;
    // the browser assembles and persists the complete plan.
    if (!generation) {
      const parsed = (await import("@/lib/schemas/preferences")).PlannerPreferencesSchema.safeParse(preferences);
      if (!parsed.success) return NextResponse.json({ error: "Invalid preferences", details: parsed.error.flatten() }, { status: 400 });
      const weekActivities = await Promise.all([1, 2, 3, 4, 5, 6, 7].map((dayNum) =>
        generateSingleActivity({
          sessionId: generationId,
          preferences: parsed.data,
          dayNumber: (weekNumber - 1) * 7 + dayNum,
          targetDomain: theme,
          excludeTitles: existingTitles,
          excludeMechanics: existingMechanics,
        })
      ));
      return NextResponse.json({
        success: true,
        week: { weekNumber, theme, days: weekActivities.map((activity, i) => ({ dayNumber: i + 1, activities: [activity] })) },
        isComplete: weekNumber === 4,
      });
    }

    // Check if this week's activities are already generated (idempotent retry)
    const existingWeekRows = db.prepare(
      `SELECT day_number, activity_data FROM planner_activities WHERE generation_id = ? AND week_number = ? ORDER BY day_number`
    ).all(generationId, weekNumber) as { day_number: number; activity_data: string }[];

    let weekActivities: PlannedActivity[];
    if (existingWeekRows.length >= 7) {
      weekActivities = existingWeekRows.map((r) => JSON.parse(r.activity_data));
    } else {
      // Generate all 7 days for this week concurrently
      const dayIndices = [1, 2, 3, 4, 5, 6, 7];
      weekActivities = await Promise.all(
        dayIndices.map((dayNum) =>
          generateSingleActivity({
            sessionId: generation.session_id,
            preferences,
            dayNumber: (weekNumber - 1) * 7 + dayNum,
            targetDomain: theme,
            excludeTitles: existingTitles,
            excludeMechanics: existingMechanics,
          })
        )
      );

      // Persist each activity in planner_activities
      for (let i = 0; i < weekActivities.length; i++) {
        const act = weekActivities[i];
        const dayNum = i + 1;
        db.prepare(`
          INSERT OR REPLACE INTO planner_activities (
            id, generation_id, week_number, day_number, activity_index, activity_data, novelty_signature
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          act.id,
          generationId,
          weekNumber,
          dayNum,
          0,
          JSON.stringify(act),
          act.noveltySignature
        );
      }
    }

    // Build the week data structure
    const weekDays: Array<{ dayNumber: number; activities: PlannedActivity[] }> =
      weekActivities.map((act, i) => ({ dayNumber: i + 1, activities: [act] }));

    const weekData = { weekNumber, theme, days: weekDays };

    // Merge into full_data if it exists, or update status
    const allWeekRows = db
      .prepare(
        `SELECT DISTINCT week_number FROM planner_activities WHERE generation_id = ? ORDER BY week_number`
      )
      .all(generationId) as { week_number: number }[];

    const completedWeeks = new Set(allWeekRows.map((r) => r.week_number));
    completedWeeks.add(weekNumber);

    // If all 4 weeks are done, assemble the full monthly planner and store it
    if (completedWeeks.size === 4) {
      const allActivities = db
        .prepare(
          `SELECT week_number, day_number, activity_data
           FROM planner_activities
           WHERE generation_id = ?
           ORDER BY week_number, day_number`
        )
        .all(generationId) as { week_number: number; day_number: number; activity_data: string }[];

      const globalMaterials = new Set<string>();
      const weekMap: Record<number, MonthlyPlanner["weeks"][0]> = {};

      for (const row of allActivities) {
        const act: PlannedActivity = JSON.parse(row.activity_data);
        act.materials.forEach((m) => globalMaterials.add(m));
        if (!weekMap[row.week_number]) {
          weekMap[row.week_number] = {
            weekNumber: row.week_number,
            theme: WEEKLY_THEMES[row.week_number - 1],
            days: [],
          };
        }
        weekMap[row.week_number].days.push({ dayNumber: row.day_number, activities: [act] });
      }

      const weeks = [1, 2, 3, 4].map((wn) => weekMap[wn]);
      const materialsList = Array.from(globalMaterials);
      const targetAge = preferences.ageBand || preferences.child?.ageBand || "4-5";

      const fullMonthlyPlanner: MonthlyPlanner = {
        id: generationId,
        sessionId,
        preferences,
        generatedAt: new Date().toISOString(),
        monthlyOverview: {
          activityMix:
            "Balanced distribution of fine-motor, creative storytelling, cognitive problem solving, and physical movement.",
          materialsToKeepNearby: materialsList.slice(0, 8),
          estimatedParentPrepPerWeek: "~10 minutes of initial setup on Sundays.",
          optionalWeeklyThemes: WEEKLY_THEMES,
          numberOfLowSupervisionActivities: 20,
        },
        prepThisMonth: (preferences.ageBand === "2-3" || preferences.child?.ageBand === "2-3")
          ? `Consolidate everyday materials into an activity basket: ${materialsList.slice(0, 8).join(", ")}. Reusable across all 4 weeks to help you start each supervised activity quickly.`
          : `Consolidate everyday materials into an activity basket: ${materialsList.slice(0, 8).join(", ")}. Reusable across all 4 weeks without purchasing new craft kits.`,
        weeks,
        globalMaterialsPool: materialsList,
      };

      const day1 = weeks[0].days[0].activities[0];
      const day2 = weeks[0].days[1].activities[0];

      const preview = {
        generationId,
        productType: "monthly",
        targetAgeBand: targetAge,
        preferencesSummary: {
          ageBand: targetAge,
          interests: [...(preferences.interests || []), ...(preferences.customInterests || [])],
          goals: preferences.goals || [],
          environment: preferences.environment || "indoors",
          duration: preferences.duration || "20-30",
          parentInvolvement:
            preferences.involvement || preferences.parentInvolvement || "setup_then_independent",
          materials: preferences.selectedMaterials || preferences.materials || [],
        },
        day1Activity: day1,
        day2Teaser: {
          title: day2.title,
          descriptionSnippet: day2.description.slice(0, 60) + "...",
          developmentalDomains: day2.developmentalDomains,
          estimatedMinutes: day2.activityMinutes.max,
          setupMinutes: day2.setupMinutes,
          supervisionLevel: day2.supervisionLevel,
        },
        totalActivitiesCount: 28,
        materialsOverview: materialsList,
        prepWeekSummary: fullMonthlyPlanner.prepThisMonth,
        evidenceSummary: `Activities include related developmental reading for context; individual results vary.`,
        isUnlocked: false,
      };

      db.prepare(`
        UPDATE planner_generations
        SET status = 'preview_ready',
            preview_data = ?,
            full_data = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(JSON.stringify(preview), JSON.stringify(fullMonthlyPlanner), generationId);

      const response = NextResponse.json({
        success: true,
        week: weekData,
        isComplete: true,
        generationId,
        preview,
      });
      if (token) setSessionCookie(response, token);
      return response;
    }

    // Not yet complete — update status
    db.prepare(
      "UPDATE planner_generations SET status = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(`generating_week_${weekNumber}`, generationId);

    const response = NextResponse.json({
      success: true,
      week: weekData,
      isComplete: false,
      completedWeeks: Array.from(completedWeeks),
    });
    if (token) setSessionCookie(response, token);
    return response;
  } catch (err: unknown) {
    console.error("[Week Chunk Error]:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate week" },
      { status: 500 }
    );
  }
}
