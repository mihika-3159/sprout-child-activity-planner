import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import {
  listFeedback,
  setFeedbackResolved,
  type FeedbackRecord,
} from "@/lib/feedback/store";

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const feedbackList: FeedbackRecord[] = await listFeedback(200);

    const total = feedbackList.length;
    const avgRating = total > 0 
      ? Number((feedbackList.reduce((acc, f) => acc + (f.rating || 0), 0) / total).toFixed(1)) 
      : null;

    return NextResponse.json({
      totalCount: total,
      averageRating: avgRating,
      feedback: feedbackList,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: unknown) {
    console.error("[Admin Feedback API Error]:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load user feedback" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const denied = await requireAdmin(request, true);
  if (denied) return denied;
  try {
    const body = await request.json();
    const { feedbackId, resolved } = body;

    if (typeof feedbackId !== "number" && typeof feedbackId !== "string") {
      return NextResponse.json({ error: "Invalid feedback ID" }, { status: 400 });
    }

    if (!Number.isSafeInteger(Number(feedbackId)) || Number(feedbackId) < 1 || typeof resolved !== "boolean") {
      return NextResponse.json({ error: "Invalid feedback update" }, { status: 400 });
    }
    await setFeedbackResolved(Number(feedbackId), resolved);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[Admin Feedback PATCH Error]:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update feedback" },
      { status: 500 }
    );
  }
}
