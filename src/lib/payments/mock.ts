/**
 * Mock Sandbox Payment Provider (Development / Beta Sandbox Only)
 *
 * CRITICAL: This is clearly labeled as a test sandbox and allows full testing
 * of checkout, entitlement gating, and download flows without requiring external payment keys.
 *
 * Per spec sections 7, 26C.
 */
import { v4 as uuidv4 } from "uuid";
import { PaymentProvider, CheckoutSessionRequest, CheckoutSessionResponse } from "./interface";

export class MockPaymentProvider implements PaymentProvider {
  id = "mock_sandbox";

  async createCheckoutSession(request: CheckoutSessionRequest): Promise<CheckoutSessionResponse> {
    const transactionId = `sandbox_tx_${uuidv4().slice(0, 8)}`;

    // Build the sandbox completion URL pointing directly to the mock confirmation endpoint
    const url = `/api/checkout/mock-complete?tx=${transactionId}&sid=${request.sessionId}&gid=${request.generationId}&product=${request.productType}`;

    return {
      checkoutUrl: url,
      transactionId,
      isSandbox: true,
    };
  }

  async verifyWebhook() {
    return null;
  }
}
