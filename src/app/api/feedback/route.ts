import { NextRequest, NextResponse } from "next/server";
import { getOrCreateSession } from "@/lib/session/anonymous";
import { redactIdentifyingInformation } from "@/lib/privacy/redaction";
import { getDb } from "@/lib/db/schema";

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await getOrCreateSession();
    const body = await request.json();

    const rawFeedback = typeof body.feedback === "string" ? body.feedback.trim() : "";
    const rating = typeof body.rating === "number" ? Math.max(1, Math.min(5, body.rating)) : 5;
    const category = typeof body.category === "string" ? body.category.slice(0, 50) : "general";

    if (!rawFeedback && !body.rating) {
      return NextResponse.json(
        { error: "Please provide a rating or feedback message." },
        { status: 400 }
      );
    }

    // Strictly redact any identifying information before storing
    const redacted = redactIdentifyingInformation(rawFeedback);
    const cleanedFeedback = redacted.redacted.slice(0, 2000);

    const db = getDb();
    db.prepare(`
      INSERT INTO user_feedback (session_id, rating, feedback, category)
      VALUES (?, ?, ?, ?)
    `).run(sessionId, rating, cleanedFeedback, category);

    return NextResponse.json({
      success: true,
      message: "Thank you! Your feedback helps us improve Sprout for every family.",
    });
  } catch (err: unknown) {
    console.error("[Feedback API Error]:", err);
    return NextResponse.json(
      { error: "Failed to submit feedback. Please try again." },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const db = getDb();
    const feedback = db
      .prepare("SELECT id, rating, feedback, category, created_at FROM user_feedback ORDER BY created_at DESC LIMIT 100")
      .all();
    return NextResponse.json({ feedback });
  } catch (err: unknown) {
    console.error("[Feedback Query Error]:", err);
    return NextResponse.json({ error: "Failed to retrieve feedback" }, { status: 500 });
  }
}

