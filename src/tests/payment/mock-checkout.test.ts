import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { GET as completeMockCheckout } from "@/app/api/checkout/mock-complete/route";
import { getDb } from "@/lib/db/schema";
import { verifyEntitlement } from "@/lib/entitlement/check";
import { createSession, verifySession, SESSION_COOKIE_NAME } from "@/lib/session/anonymous";
import { MockPaymentProvider } from "@/lib/payments/mock";
import { getPaymentProvider } from "@/lib/payments";

const originalStripeKey = process.env.STRIPE_SECRET_KEY;

afterEach(() => {
  if (originalStripeKey === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = originalStripeKey;
});

async function session() {
  const token = await createSession();
  const data = await verifySession(token);
  if (!data) throw new Error("Cannot create signed test session");
  return { token, id: data.sessionId };
}

function createPlanner(id: string, owner: string, productType: string) {
  getDb().prepare(
    "INSERT INTO planner_generations (id, session_id, product_type, status, preferences) VALUES (?, ?, ?, ?, ?)"
  ).run(id, owner, productType, "preview_ready", "{}");
}

function requestFor(
  generationId: string,
  productType: string,
  token?: string,
  otherParams = ""
) {
  const url = `http://localhost/api/checkout/mock-complete?gid=${generationId}&product=${productType}${otherParams}`;
  return new NextRequest(url, {
    headers: token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {},
  });
}

describe("mock checkout never grants an unverified payment", () => {
  it("rejects a forged completion URL with no signed cookie", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const id = uuidv4();
    const res = await completeMockCheckout(requestFor(id, "weekly", undefined, "&sid=forged&tx=paid"));
    expect(res.status).toBe(401);
    expect(verifyEntitlement("forged", id)).toBeNull();
  });

  it("lets an owner reach their free-beta planner without storing any paid entitlement", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const owner = await session();
    const id = uuidv4();
    createPlanner(id, owner.id, "weekly");

    const res = await completeMockCheckout(requestFor(id, "weekly", owner.token, "&sid=attacker&tx=forged"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain(`/planner/${id}?unlocked=true&sandbox=true`);
    expect(verifyEntitlement(owner.id, id)).toBeNull();
  });

  it("rejects a different session even when it knows the generation ID", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const owner = await session();
    const stranger = await session();
    const id = uuidv4();
    createPlanner(id, owner.id, "weekly");
    const res = await completeMockCheckout(requestFor(id, "weekly", stranger.token, `&sid=${owner.id}`));
    expect(res.status).toBe(404);
    expect(verifyEntitlement(owner.id, id)).toBeNull();
  });

  it("rejects a mismatched product and an unknown product", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const owner = await session();
    const id = uuidv4();
    createPlanner(id, owner.id, "weekly");
    expect((await completeMockCheckout(requestFor(id, "monthly", owner.token))).status).toBe(404);
    expect((await completeMockCheckout(requestFor(id, "__proto__", owner.token))).status).toBe(400);
  });

  it("disables the mock endpoint when any Stripe key is configured", async () => {
    const owner = await session();
    process.env.STRIPE_SECRET_KEY = "sk_test_configured";
    const res = await completeMockCheckout(requestFor(uuidv4(), "weekly", owner.token));
    expect(res.status).toBe(404);
  });

  it("never places session IDs or transaction IDs in mock checkout URLs", async () => {
    const provider = new MockPaymentProvider();
    const res = await provider.createCheckoutSession({
      sessionId: "private-session",
      generationId: "generation-id",
      productType: "weekly",
      successUrl: "http://localhost/success",
      cancelUrl: "http://localhost/cancel",
    });
    expect(res.isSandbox).toBe(true);
    expect(res.checkoutUrl).toContain("gid=generation-id");
    expect(res.checkoutUrl).not.toContain("private-session");
    expect(res.checkoutUrl).not.toContain("tx=");
    expect(res.checkoutUrl).not.toContain("sid=");
  });

  it("fails closed instead of choosing mock provider for invalid Stripe configuration", () => {
    process.env.STRIPE_SECRET_KEY = "invalid-secret";
    expect(() => getPaymentProvider()).toThrow("Invalid STRIPE_SECRET_KEY");
  });
});
