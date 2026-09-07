import { NextRequest, NextResponse } from "next/server";
import { createEntitlement } from "@/lib/entitlement/check";
import { getDb } from "@/lib/db/schema";

/**
 * Mock Sandbox Completion Route
 *
 * Simulates a successful checkout callback in test/development environments.
 * Creates a valid server entitlement and redirects the user to their unlocked planner.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tx = searchParams.get("tx");
  const sid = searchParams.get("sid");
  const gid = searchParams.get("gid");
  const product = searchParams.get("product") as "weekly" | "monthly" | "yearly";

  if (!tx || !sid || !gid || !product) {
    return NextResponse.redirect(new URL("/?error=invalid_mock_params", request.url));
  }

  // Record entitlement in DB
  createEntitlement({
    sessionId: sid,
    generationId: gid,
    providerTransactionId: tx,
    productType: product,
    paymentStatus: "paid",
  });

  // Record analytics
  const db = getDb();
  db.prepare(`
    INSERT INTO analytics_events (event_type, product_type)
    VALUES ('purchase_completed', ?)
  `).run(product);

  // Redirect to full planner view
  return NextResponse.redirect(new URL(`/planner/${gid}?unlocked=true&sandbox=true`, request.url));
}
