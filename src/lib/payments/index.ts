/**
 * Payment Provider Selector
 */
import { PaymentProvider } from "./interface";
import { StripePaymentProvider } from "./stripe";
import { MockPaymentProvider } from "./mock";

export function getPaymentProvider(): PaymentProvider {
  if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.startsWith("sk_")) {
    return new StripePaymentProvider();
  }
  return new MockPaymentProvider();
}

export * from "./interface";
