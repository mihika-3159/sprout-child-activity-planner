/**
 * Stripe Payment Adapter
 *
 * Safe tokenized checkout using Stripe Checkout Sessions.
 * No credit card numbers ever touch our servers or database.
 */
import Stripe from "stripe";
import { PaymentProvider, CheckoutSessionRequest, CheckoutSessionResponse } from "./interface";
import { getProduct } from "../config/products";

export class StripePaymentProvider implements PaymentProvider {
  id = "stripe";
  private stripe: Stripe | null = null;

  private getClient(): Stripe {
    if (this.stripe) return this.stripe;
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    this.stripe = new Stripe(key, { apiVersion: "2025-02-24.acacia" as unknown as Stripe.LatestApiVersion });
    return this.stripe;
  }

  async createCheckoutSession(request: CheckoutSessionRequest): Promise<CheckoutSessionResponse> {
    const stripe = this.getClient();
    const product = getProduct(request.productType);

    // If price is null / free during beta
    const priceAmount = product.priceInPence ?? 0;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: product.currency.toLowerCase(),
            product_data: {
              name: `Sprout ${product.name}`,
              description: product.description,
            },
            unit_amount: priceAmount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${request.successUrl}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: request.cancelUrl,
      client_reference_id: request.sessionId,
      metadata: {
        sessionId: request.sessionId,
        generationId: request.generationId,
        productType: request.productType,
      },
    });

    return {
      checkoutUrl: session.url || "",
      transactionId: session.id,
      isSandbox: !process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_"),
    };
  }

  async verifyWebhook(rawBody: string, signature: string) {
    const stripe = this.getClient();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
    }

    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      return {
        transactionId: session.id,
        sessionId: session.metadata?.sessionId || (session.client_reference_id as string),
        generationId: session.metadata?.generationId,
        productType: (session.metadata?.productType as "weekly" | "monthly" | "yearly") || "weekly",
        status: "paid" as const,
      };
    }

    return null;
  }
}
