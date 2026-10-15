import { NextRequest, NextResponse } from "next/server";
import { getOrCreateSession } from "@/lib/session/anonymous";
import { redactIdentifyingInformation } from "@/lib/privacy/redaction";
import { saveFeedback } from "@/lib/feedback/store";

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await getOrCreateSession();
    const body = await request.json();
    const message = typeof body?.feedback === "string" ? body.feedback.trim() : "";
    const rating = typeof body?.rating === "number" && Number.isInteger(body.rating)
      ? Math.max(1, Math.min(5, body.rating)) : 5;
    const category = typeof body?.category === "string" ? body.category.slice(0, 50) : "general";
    if (!message && !body?.rating) {
      return NextResponse.json({ error: "Please provide a rating or feedback message." }, { status: 400 });
    }
    const redacted = redactIdentifyingInformation(message);
    await saveFeedback({
      sessionId,
      rating,
      feedback: redacted.redacted.slice(0, 2000),
      category,
    });
    return NextResponse.json({
      success: true,
      message: "Thank you! Your feedback helps us improve Sprout for every family.",
    });
  } catch (error: unknown) {
    console.error("[Feedback API Error]:", error);
    return NextResponse.json({ error: "Failed to submit feedback. Please try again." }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Feedback is not publicly available" },
    { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } },
  );
}
