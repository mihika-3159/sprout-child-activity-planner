import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session/anonymous";
import { getDb } from "@/lib/db/schema";
import { PLANNER_PRODUCTS, PlannerProduct } from "@/lib/config/products";

/**
 * Free-beta sandbox redirect only. It must NEVER record paid entitlements:
 * query parameters are attacker-controlled, not payment confirmation.
 */
export async function GET(request: NextRequest) {
  // If Stripe is configured, the mock completion endpoint must be inert.
  if (process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Sandbox checkout unavailable" }, { status: 404 });
  }

  // Only an existing, signed anonymous session can complete this navigation.
  // Never accept session identifiers or transaction IDs from the URL.
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Session required" }, { status: 401 });
  }

  const gid = request.nextUrl.searchParams.get("gid");
  const product = request.nextUrl.searchParams.get("product");
  if (
    !gid ||
    !product ||
    !Object.prototype.hasOwnProperty.call(PLANNER_PRODUCTS, product) ||
    !PLANNER_PRODUCTS[product as PlannerProduct].enabled
  ) {
    return NextResponse.json({ error: "Invalid sandbox parameters" }, { status: 400 });
  }

  // Verify ownership explicitly. The storage adapter's owner-scoped WHERE
  // queries have previously had flaws, so do not trust the SQL clause alone.
  const generation = getDb()
    .prepare("SELECT id, session_id, product_type FROM planner_generations WHERE id = ?")
    .get(gid) as { session_id?: string; product_type?: string } | undefined;
  if (!generation || generation.session_id !== session.sessionId || generation.product_type !== product) {
    return NextResponse.json({ error: "Planner not found" }, { status: 404 });
  }

  // This is a free beta, not a purchase. No entitlement or paid record.
  return NextResponse.redirect(new URL(`/planner/${encodeURIComponent(gid)}?unlocked=true&sandbox=true`, request.url));
}
