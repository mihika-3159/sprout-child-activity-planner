/**
 * Payment Provider Selector
 */
import { PaymentProvider } from "./interface";
import { StripePaymentProvider } from "./stripe";
import { MockPaymentProvider } from "./mock";

export function getPaymentProvider(): PaymentProvider {
  if (process.env.STRIPE_SECRET_KEY) {
    if (!process.env.STRIPE_SECRET_KEY.startsWith("sk_")) {
      throw new Error("Invalid STRIPE_SECRET_KEY; refusing sandbox payment fallback");
    }
    return new StripePaymentProvider();
  }
  return new MockPaymentProvider();
}

export * from "./interface";
