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
});
