import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db/schema";

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const db = getDb();
  const audits = db.prepare("SELECT * FROM generation_audits ORDER BY created_at DESC LIMIT 50").all();
  const analytics = db
    .prepare("SELECT event_type, COUNT(*) as count FROM analytics_events GROUP BY event_type")
    .all();

  return NextResponse.json({ audits, analytics }, { headers: { "Cache-Control": "no-store" } });
}
