/**
 * Payment Provider Abstraction Layer
 *
 * Provides a clean interface so the checkout provider can be replaced anytime.
 * Per spec sections 7, 26C.
 *
 * In development / test mode without real Stripe keys:
 * Uses a clearly marked sandbox checkout.
 * NEVER pretends a mock transaction is real in production.
 */
import { PlannerProduct } from "../config/products";

export interface CheckoutSessionRequest {
  sessionId: string;
  generationId: string;
  productType: PlannerProduct;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResponse {
  checkoutUrl: string;
  transactionId: string;
  isSandbox: boolean;
}

export interface PaymentProvider {
  id: string;
  createCheckoutSession(request: CheckoutSessionRequest): Promise<CheckoutSessionResponse>;
  verifyWebhook(rawBody: string, signature: string): Promise<{
    transactionId: string;
    sessionId: string;
    generationId?: string;
    productType: PlannerProduct;
    status: "paid" | "failed" | "refunded";
  } | null>;
}
