import { NextRequest, NextResponse } from "next/server";
import { getOrCreateSession } from "@/lib/session/anonymous";
import { getPaymentProvider } from "@/lib/payments";
import { PlannerProduct, PLANNER_PRODUCTS } from "@/lib/config/products";
import { getDb } from "@/lib/db/schema";
import { rateLimitMiddleware } from "@/lib/rateLimit/rateLimiter";

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await getOrCreateSession();

    // Rate limit checkout starts
    const rateLimit = rateLimitMiddleware(sessionId, "plannerPreviews");
    if (rateLimit) {
      return NextResponse.json(rateLimit.json, { status: rateLimit.status });
    }

    const body = await request.json();
    const { generationId, productType } = body as {
      generationId: string;
      productType: PlannerProduct;
    };

    if (!generationId || !productType || !PLANNER_PRODUCTS[productType]) {
      return NextResponse.json({ error: "Invalid generationId or productType" }, { status: 400 });
    }

    // Verify generation belongs to this session
    const db = getDb();
    const generation = db
      .prepare("SELECT id FROM planner_generations WHERE id = ? AND session_id = ?")
      .get(generationId, sessionId);

    if (!generation) {
      return NextResponse.json({ error: "Planner generation not found" }, { status: 404 });
    }

    const origin = request.headers.get("origin") || request.nextUrl.origin;
    const provider = getPaymentProvider();

    const checkoutSession = await provider.createCheckoutSession({
      sessionId,
      generationId,
      productType,
      successUrl: `${origin}/planner/${generationId}?unlocked=true`,
      cancelUrl: `${origin}/preview/${generationId}?cancelled=true`,
    });

    // Record analytics event
    db.prepare(`
      INSERT INTO analytics_events (event_type, product_type)
      VALUES ('checkout_started', ?)
    `).run(productType);

    return NextResponse.json(checkoutSession);
  } catch (err: unknown) {
    console.error("[Checkout API] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
