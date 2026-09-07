import { NextRequest, NextResponse } from "next/server";
import { getPaymentProvider } from "@/lib/payments";
import { updateEntitlementStatus, createEntitlement } from "@/lib/entitlement/check";
import { getDb } from "@/lib/db/schema";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("stripe-signature") || "";

    const provider = getPaymentProvider();
    const event = await provider.verifyWebhook(rawBody, signature);

    if (event) {
      if (event.status === "paid") {
        createEntitlement({
          sessionId: event.sessionId,
          generationId: event.generationId,
          providerTransactionId: event.transactionId,
          productType: event.productType,
          paymentStatus: "paid",
        });

        const db = getDb();
        db.prepare(`
          INSERT INTO analytics_events (event_type, product_type)
          VALUES ('purchase_completed', ?)
        `).run(event.productType);
      } else {
        updateEntitlementStatus(event.transactionId, event.status, event.generationId);
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    console.error("[Webhook Error]:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Webhook processing failed" },
      { status: 400 }
    );
  }
}
