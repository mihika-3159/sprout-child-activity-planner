import { NextRequest, NextResponse } from "next/server";
import { PRIMARY_ADMIN_EMAIL } from "@/lib/config/admin";
import {
  listFeedback,
  setFeedbackResolved,
  type FeedbackRecord,
} from "@/lib/feedback/store";

export async function GET() {
  try {
    const feedbackList: FeedbackRecord[] = await listFeedback(200);

    const total = feedbackList.length;
    const avgRating = total > 0 
      ? Number((feedbackList.reduce((acc, f) => acc + (f.rating || 0), 0) / total).toFixed(1)) 
      : 5.0;

    return NextResponse.json({
      adminAccount: PRIMARY_ADMIN_EMAIL,
      totalCount: total,
      averageRating: avgRating,
      feedback: feedbackList,
    });
  } catch (err: unknown) {
    console.error("[Admin Feedback API Error]:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load user feedback" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { feedbackId, resolved } = body;

    if (typeof feedbackId !== "number" && typeof feedbackId !== "string") {
      return NextResponse.json({ error: "Invalid feedback ID" }, { status: 400 });
    }

    await setFeedbackResolved(Number(feedbackId), Boolean(resolved));

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[Admin Feedback PATCH Error]:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update feedback" },
      { status: 500 }
    );
  }
}
