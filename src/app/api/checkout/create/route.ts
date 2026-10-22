import { NextRequest, NextResponse } from "next/server";
import { getOrCreateSession, setSessionCookie } from "@/lib/session/anonymous";
import { getPaymentProvider } from "@/lib/payments";
import { PlannerProduct, PLANNER_PRODUCTS } from "@/lib/config/products";
import { getDb } from "@/lib/db/schema";
import { rateLimitMiddleware } from "@/lib/rateLimit/rateLimiter";

export async function POST(request: NextRequest) {
  try {
    const { sessionId, token } = await getOrCreateSession();

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

    if (!generationId || !productType || !Object.prototype.hasOwnProperty.call(PLANNER_PRODUCTS, productType) || !PLANNER_PRODUCTS[productType].enabled) {
      return NextResponse.json({ error: "Invalid generationId or productType" }, { status: 400 });
    }

    // Verify generation belongs to this session
    const db = getDb();
    const generation = db
      .prepare("SELECT id, session_id, product_type FROM planner_generations WHERE id = ?")
      .get(generationId) as { session_id?: string; product_type?: string } | undefined;

    if (!generation || generation.session_id !== sessionId || generation.product_type !== productType) {
      return NextResponse.json({ error: "Planner generation not found" }, { status: 404 });
    }

    const origin = request.headers.get("origin") || request.nextUrl.origin;
    const provider = getPaymentProvider();
    // Do not simulate purchase of a paid product when Stripe is unavailable.
    if (provider.id === "mock_sandbox" && (PLANNER_PRODUCTS[productType].priceInPence ?? 0) > 0) {
      return NextResponse.json({ error: "Paid checkout is not configured" }, { status: 503 });
    }

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

    return setSessionCookie(NextResponse.json(checkoutSession), token);
  } catch (err: unknown) {
    console.error("[Checkout API] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
