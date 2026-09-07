import { NextRequest, NextResponse } from "next/server";
import { getOrCreateSession } from "@/lib/session/anonymous";
import { PlannerPreferencesSchema } from "@/lib/schemas/preferences";
import { composeWeeklyPlanner, composeMonthlyPlanner } from "@/lib/generation/composer";
import { rateLimitMiddleware } from "@/lib/rateLimit/rateLimiter";
import { getDb } from "@/lib/db/schema";

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await getOrCreateSession();

    // 1. Rate limiting check
    const rateLimit = rateLimitMiddleware(sessionId, "fullPlannerGenerations");
    if (rateLimit) {
      return NextResponse.json(rateLimit.json, { status: rateLimit.status });
    }

    const rawBody = await request.json();

    // 2. Validate input strictly against Zod schema (No PII allowed)
    const parseResult = PlannerPreferencesSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid planner preferences", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const preferences = parseResult.data;

    // 3. Update session preference profile
    const db = getDb();
    db.prepare(`
      INSERT INTO anonymous_sessions (id, preference_data, last_seen)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        preference_data = excluded.preference_data,
        last_seen = datetime('now')
    `).run(sessionId, JSON.stringify(preferences));

    // 4. Record analytics
    db.prepare(`
      INSERT INTO analytics_events (event_type, product_type)
      VALUES ('preferences_completed', ?)
    `).run(preferences.productType);

    // 5. Compose the plan and get safe server-gated preview
    let previewResult;
    if (preferences.productType === "monthly") {
      previewResult = await composeMonthlyPlanner({ sessionId, preferences });
    } else {
      previewResult = await composeWeeklyPlanner({ sessionId, preferences });
    }

    db.prepare(`
      INSERT INTO analytics_events (event_type, product_type)
      VALUES ('preview_generated', ?)
    `).run(preferences.productType);

    // Return the safe preview payload
    return NextResponse.json({
      success: true,
      generationId: previewResult.preview.generationId,
      preview: previewResult.preview,
    });
  } catch (err: unknown) {
    console.error("[Planner Generate Error]:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate activity plan" },
      { status: 500 }
    );
  }
}
