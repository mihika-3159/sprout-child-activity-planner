import { describe, it, expect } from "vitest";
import { createEntitlement, verifyEntitlement } from "../../lib/entitlement/check";

describe("Server-Side Entitlement & Paywall Gating (Spec Sections 6, 14)", () => {
  it("returns null before purchase entitlement is created", () => {
    const unpurchasedSessionId = "fresh-session-" + Date.now();
    const unpurchasedGenId = "fresh-gen-" + Date.now();
    const entitlement = verifyEntitlement(unpurchasedSessionId, unpurchasedGenId);
    expect(entitlement).toBeNull();
  });

  it("verifies entitlement once webhook or payment records confirmed status", () => {
    const sessionId = "session-paid-" + Date.now();
    const generationId = "gen-paid-" + Date.now();

    createEntitlement({
      sessionId,
      generationId,
      providerTransactionId: "tx_mock_" + Date.now(),
      productType: "weekly",
      paymentStatus: "paid",
    });

    const entitlement = verifyEntitlement(sessionId, generationId);
    expect(entitlement).not.toBeNull();
    expect(entitlement?.paymentStatus).toBe("paid");
    expect(entitlement?.productType).toBe("weekly");
  });

  it("rejects verification for different session identifiers", () => {
    const sessionId = "session-isolated-" + Date.now();
    const generationId = "gen-isolated-" + Date.now();

    createEntitlement({
      sessionId,
      generationId,
      providerTransactionId: "tx_iso_" + Date.now(),
      productType: "monthly",
      paymentStatus: "paid",
    });

    const foreignSessionEntitlement = verifyEntitlement("different-session-999", generationId);
    expect(foreignSessionEntitlement).toBeNull();
  });
});
