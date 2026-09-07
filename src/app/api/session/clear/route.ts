import { NextRequest, NextResponse } from "next/server";
import { getOrCreateSession, clearSessionCookie } from "@/lib/session/anonymous";
import { getDb } from "@/lib/db/schema";

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await getOrCreateSession();
    const db = getDb();

    // 1. Delete all planner activities for this session
    db.prepare(`
      DELETE FROM planner_activities
      WHERE generation_id IN (
        SELECT id FROM planner_generations WHERE session_id = ?
      )
    `).run(sessionId);

    // 2. Delete all generations
    db.prepare("DELETE FROM planner_generations WHERE session_id = ?").run(sessionId);

    // 3. Delete all activity fingerprints
    db.prepare("DELETE FROM activity_fingerprints WHERE session_id = ?").run(sessionId);

    // 4. Delete rate limit tokens for this session
    db.prepare("DELETE FROM rate_limit_tokens WHERE hashed_id LIKE ?").run(`%${sessionId.slice(0, 10)}%`);

    // 5. Mark session cleared or remove
    db.prepare("DELETE FROM anonymous_sessions WHERE id = ?").run(sessionId);

    // 6. Record privacy analytics event
    db.prepare("INSERT INTO analytics_events (event_type) VALUES ('clear_information')").run();

    const response = NextResponse.json({
      success: true,
      message: "All session preferences, planner history, and generation fingerprints have been permanently cleared.",
    });

    return clearSessionCookie(response);
  } catch (err: unknown) {
    console.error("[Clear Session Error]:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to clear information" },
      { status: 500 }
    );
  }
}
