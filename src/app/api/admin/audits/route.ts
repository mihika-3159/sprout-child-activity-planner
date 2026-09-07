import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/schema";

export async function GET() {
  const db = getDb();
  const audits = db.prepare("SELECT * FROM generation_audits ORDER BY created_at DESC LIMIT 50").all();
  const analytics = db
    .prepare("SELECT event_type, COUNT(*) as count FROM analytics_events GROUP BY event_type")
    .all();

  return NextResponse.json({ audits, analytics });
}
