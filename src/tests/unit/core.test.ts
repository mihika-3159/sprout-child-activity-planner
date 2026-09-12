import { describe, it, expect } from "vitest";
import { redactIdentifyingInformation, hasIdentifyingInformation } from "../../lib/privacy/redaction";
import { canAutoIngestForCommercialUse, requiresManualReview, isBlockedForCommercialUse } from "../../lib/evidence/license";
import { createConceptHash, createNoveltySignature } from "../../lib/generation/novelty";

describe("Privacy Redaction Suite", () => {
  it("redacts email addresses", () => {
    const text = "Please email me at parent@example.com for more info";
    const result = redactIdentifyingInformation(text);
    expect(result.wasModified).toBe(true);
    expect(result.redacted).toContain("[email removed]");
    expect(result.detectedTypes).toContain("email");
  });

  it("redacts phone numbers", () => {
    const text = "Call 07123 456789 or +1 555-0199";
    const result = redactIdentifyingInformation(text);
    expect(result.wasModified).toBe(true);
    expect(result.detectedTypes).toContain("phone");
  });

  it("redacts UK and US postal codes", () => {
    const text = "We live near SW1A 1AA and previously 90210";
    const result = redactIdentifyingInformation(text);
    expect(result.wasModified).toBe(true);
    expect(result.detectedTypes).toContain("postcode");
  });

  it("detects potential child names when phrased with indicators", () => {
    const text = "My daughter loves drawing dinosaurs";
    const result = redactIdentifyingInformation(text);
    expect(result.detectedTypes).toContain("potential_name");
  });

  it("leaves clean structured preferences untouched", () => {
    const text = "dinosaurs, space, building, paper, cardboard";
    const result = redactIdentifyingInformation(text);
    expect(result.wasModified).toBe(false);
    expect(result.detectedTypes.length).toBe(0);
  });
});

describe("Commercial License Allowlist Suite (Spec Section 2B)", () => {
  it("allows strict approved licenses for commercial reuse", () => {
    expect(canAutoIngestForCommercialUse("PUBLIC_DOMAIN")).toBe(true);
    expect(canAutoIngestForCommercialUse("CC0")).toBe(true);
    expect(canAutoIngestForCommercialUse("CC_BY")).toBe(true);
  });

  it("blocks non-commercial licenses automatically", () => {
    expect(canAutoIngestForCommercialUse("CC_BY_NC")).toBe(false);
    expect(isBlockedForCommercialUse("CC_BY_NC")).toBe(true);
    expect(canAutoIngestForCommercialUse("CC_BY_NC_SA")).toBe(false);
    expect(isBlockedForCommercialUse("CC_BY_NC_ND")).toBe(true);
  });

  it("requires manual admin review for share-alike or custom licenses", () => {
    expect(requiresManualReview("CC_BY_SA")).toBe(true);
    expect(requiresManualReview("CC_BY_ND")).toBe(true);
    expect(requiresManualReview("CUSTOM")).toBe(true);
  });
});

describe("Novelty & Fingerprint Engine (Spec Section 4)", () => {
  it("generates consistent concept hashes for equivalent domain sets", () => {
    const hash1 = createConceptHash({
      domains: ["fine_motor", "numeracy"],
      materials: ["paper", "crayons"],
      mechanism: "sorting",
    });
    const hash2 = createConceptHash({
      domains: ["numeracy", "fine_motor"],
      materials: ["crayons", "paper"],
      mechanism: "sorting",
    });
    expect(hash1).toBe(hash2);
  });

  it("distinguishes activities with different mechanisms or materials", () => {
    const hash1 = createConceptHash({
      domains: ["fine_motor"],
      materials: ["paper"],
      mechanism: "origami",
    });
    const hash2 = createConceptHash({
      domains: ["fine_motor"],
      materials: ["cardboard"],
      mechanism: "building",
    });
    expect(hash1).not.toBe(hash2);
  });
});

describe("AI Providers Suite", () => {
  it("instantiates Cohere and Gemini providers properly", async () => {
    const { CohereProvider } = await import("../../lib/ai/providers/cohere");
    const { GeminiProvider } = await import("../../lib/ai/providers/gemini");
    const { registerProvider, getProvider } = await import("../../lib/ai/interface");

    const cohere = new CohereProvider();
    expect(cohere.id).toBe("cohere");
    expect(cohere.name).toContain("Cohere");

    const gemini = new GeminiProvider();
    expect(gemini.id).toBe("gemini");
    expect(gemini.name).toContain("Gemini");

    registerProvider(cohere);
    const retrieved = getProvider("cohere");
    expect(retrieved.id).toBe("cohere");
  }, 20000);
});

