import { describe, it, expect, beforeAll } from "vitest";
import { ensureEvidenceSeeded } from "../../lib/evidence/seed";
import { retrieveApprovedEvidence } from "../../lib/evidence/retrieval";

describe("RAG Evidence Retrieval Engine (Spec Section 2)", () => {
  beforeAll(async () => {
    await ensureEvidenceSeeded();
  });

  it("retrieves approved evidence for relevant fine-motor and spatial queries", async () => {
    const results = await retrieveApprovedEvidence("fine motor drawing and cutting", {
      ageMin: 4,
      ageMax: 6,
      limit: 3,
    });

    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    expect(top.chunkText.length).toBeGreaterThan(20);
    expect(top.evidenceStrength).toBeDefined();
    expect(top.urlDoi).toBeDefined();
    expect(top.freeAccessUrl).toBeDefined();
    expect(["CC_BY", "PUBLIC_DOMAIN", "CC0"]).toContain(top.license);
  });

  it("boosts evidence chunks whose developmental domains match the query", async () => {
    const results = await retrieveApprovedEvidence("numeracy block building geometry", {
      domains: ["numeracy", "problem_solving"],
      limit: 3,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].developmentalDomains).toContain("numeracy");
  });

  it("confirms the evidence corpus contains at least 20 approved, ethically-sourced references", async () => {
    const { getDb } = await import("../../lib/db/schema");
    const db = getDb();
    const sources = db.prepare("SELECT * FROM evidence_sources").all() as Array<{
      id: string;
      license: string;
      commercial_reuse_allowed: number;
      review_status: string;
    }>;

    expect(sources.length).toBeGreaterThanOrEqual(20);
    for (const source of sources) {
      expect(["CC_BY", "PUBLIC_DOMAIN", "CC0"]).toContain(source.license);
      expect(source.commercial_reuse_allowed).toBe(1);
      expect(source.review_status).toBe("approved");
    }
  });

  it("retrieves relevant evidence across diverse developmental domains and age groups", async () => {
    const soloPlayResults = await retrieveApprovedEvidence("independent solo play focus attention", {
      ageMin: 3,
      ageMax: 7,
      limit: 2,
    });
    expect(soloPlayResults.length).toBeGreaterThan(0);

    const scienceInquiryResults = await retrieveApprovedEvidence("curiosity causal science exploration nature", {
      ageMin: 4,
      ageMax: 10,
      limit: 2,
    });
    expect(scienceInquiryResults.length).toBeGreaterThan(0);

    const cooperativeSocialResults = await retrieveApprovedEvidence("cooperative shared building role play negotiation", {
      ageMin: 4,
      ageMax: 9,
      limit: 2,
    });
    expect(cooperativeSocialResults.length).toBeGreaterThan(0);
  });
});
