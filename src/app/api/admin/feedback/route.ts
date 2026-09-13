import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/schema";
import { PRIMARY_ADMIN_EMAIL } from "@/lib/config/admin";

export async function GET() {
  try {
    const db = getDb();
    const feedbackList = db
      .prepare(`
        SELECT id, session_id, rating, feedback, category, created_at 
        FROM user_feedback 
        ORDER BY created_at DESC 
        LIMIT 200
      `)
      .all() as Array<{
        id: number;
        session_id: string;
        rating: number;
        feedback: string;
        category: string;
        created_at: string;
      }>;

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
