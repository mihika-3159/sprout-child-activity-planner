import { NextRequest, NextResponse } from "next/server";
import { getOrCreateSession, setSessionCookie } from "@/lib/session/anonymous";
import { signGenerationToken } from "@/lib/session/generationToken";
import { PlannerPreferencesSchema } from "@/lib/schemas/preferences";
import { composeWeeklyPlanner } from "@/lib/generation/composer";
import { rateLimitMiddleware } from "@/lib/rateLimit/rateLimiter";
import { getDb } from "@/lib/db/schema";

export async function POST(request: NextRequest) {
  try {
    const { sessionId, token } = await getOrCreateSession();

    // 1. Rate limiting check (bypassed in demo mode for community testers)
    const isDemo = process.env.DEMO_MODE !== "false";
    if (!isDemo) {
      const rateLimit = rateLimitMiddleware(sessionId, "fullPlannerGenerations");
      if (rateLimit) {
        return NextResponse.json(rateLimit.json, { status: rateLimit.status });
      }
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

    // 5a. Monthly: seed the generation record and return the ID immediately.
    //     The client calls /api/planner/[generationId]/week for each of the 4 weeks
    //     sequentially, each completing well within serverless timeout limits.
    if (preferences.productType === "monthly") {
      const { v4: uuidv4 } = await import("uuid");
      const generationId = uuidv4();
      db.prepare(`
        INSERT INTO planner_generations (
          id, session_id, product_type, status, preferences
        ) VALUES (?, ?, 'monthly', 'pending_chunks', ?)
      `).run(generationId, sessionId, JSON.stringify(preferences));

      db.prepare(
        "INSERT INTO analytics_events (event_type, product_type) VALUES ('monthly_chunked_init', 'monthly')"
      ).run();

      const response = NextResponse.json({
        success: true,
        generationId,
        generationToken: signGenerationToken(generationId),
        chunked: true,
        totalWeeks: 4,
      });
      setSessionCookie(response, token);
      return response;
    }

    // 5b. Weekly: synchronous single-request compose (7 activities — fast enough)
    const previewResult = await composeWeeklyPlanner({ sessionId, preferences });

    db.prepare(`
      INSERT INTO analytics_events (event_type, product_type)
      VALUES ('preview_generated', ?)
    `).run(preferences.productType);

    const response = NextResponse.json({
      success: true,
      generationId: previewResult.preview.generationId,
      generationToken: signGenerationToken(previewResult.preview.generationId),
      preview: previewResult.preview,
    });
    setSessionCookie(response, token);
    return response;
  } catch (err: unknown) {
    console.error("[Planner Generate Error]:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? String(err.stack || "") : undefined;
    return NextResponse.json(
      {
        error: errorMessage || "Failed to generate activity plan",
        details: errorStack,
      },
      { status: 500 }
    );
  }
}
