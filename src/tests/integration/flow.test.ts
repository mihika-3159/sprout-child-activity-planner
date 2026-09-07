import { describe, it, expect, beforeAll } from "vitest";
import { ensureEvidenceSeeded } from "../../lib/evidence/seed";
import { composeWeeklyPlanner } from "../../lib/generation/composer";
import { PlannerPreferences } from "../../lib/schemas/preferences";
import { verifyEntitlement, createEntitlement, getProtectedPlannerData } from "../../lib/entitlement/check";
import { generateSingleActivity } from "../../lib/generation/pipeline";

describe("End-to-End Product Flow (Spec Sections 3, 6, 12, 14)", () => {
  const testSessionId = `test_flow_${Date.now()}`;
  let currentGenerationId: string;

  const preferences: PlannerPreferences = {
    child: { ageBand: "6-7", numberOfChildren: 1, additionalChildAgeBands: [] },
    interests: ["science", "building"],
    customInterests: ["telescopes"],
    goals: ["problem_solving", "creativity"],
    environment: "indoors",
    duration: "20-30",
    parentInvolvement: "setup_then_independent",
    prepTolerance: "under_5_min",
    materials: ["paper", "cardboard", "tape"],
    householdMaterialsOnly: true,
    energyLevel: "moderate",
    activitiesPerDay: 1,
    productType: "weekly",
  };

  beforeAll(async () => {
    await ensureEvidenceSeeded();
  });

  it("composes a complete 7-day weekly planner and creates a secure preview payload", async () => {
    const { planner, preview } = await composeWeeklyPlanner({
      sessionId: testSessionId,
      preferences,
    });

    currentGenerationId = planner.id;

    // 1. Full planner has 7 days
    expect(planner.days.length).toBe(7);
    expect(planner.id).toBeDefined();

    // 2. Preview payload gating check (Spec section 14)
    // Preview MUST have full Day 1
    expect(preview.day1Activity).toBeDefined();
    expect(preview.day1Activity.title).toBeDefined();
    expect(preview.day1Activity.evidence.length).toBeGreaterThan(0);

    // Preview MUST have day 2 teaser snippet only
    expect(preview.day2Teaser).toBeDefined();
    expect(preview.day2Teaser.title).toBeDefined();

    // Preview MUST NOT expose days 3-7 full details
    expect((preview as unknown as { days?: unknown }).days).toBeUndefined();
    expect(preview.isUnlocked).toBe(false);
  });

  it("strictly prevents access to full protected planner data before entitlement", () => {
    expect(currentGenerationId).toBeDefined();

    // Verify entitlement is null
    const entitlement = verifyEntitlement(testSessionId, currentGenerationId);
    expect(entitlement).toBeNull();

    // Protected planner data must return null
    const protectedData = getProtectedPlannerData(testSessionId, currentGenerationId);
    expect(protectedData).toBeNull();
  });

  it("releases complete 7-day planner once server confirms payment entitlement", () => {
    expect(currentGenerationId).toBeDefined();

    // Simulate webhook / checkout entitlement grant
    createEntitlement({
      sessionId: testSessionId,
      generationId: currentGenerationId,
      providerTransactionId: `tx_flow_${Date.now()}`,
      productType: "weekly",
      paymentStatus: "paid",
    });

    // Verify entitlement now passes
    const entitlement = verifyEntitlement(testSessionId, currentGenerationId);
    expect(entitlement).not.toBeNull();
    expect(entitlement?.paymentStatus).toBe("paid");

    // Full data is now accessible server-side
    const fullData = getProtectedPlannerData(testSessionId, currentGenerationId) as {
      days: Array<{ dayNumber: number; activities: unknown[] }>;
    };
    expect(fullData).not.toBeNull();
    expect(fullData.days.length).toBe(7);
  });

  it("regenerates an individual activity while preserving existing constraints", async () => {
    const newActivity = await generateSingleActivity({
      sessionId: testSessionId,
      preferences,
      dayNumber: 3,
      activityIndex: 0,
      targetDomain: "problem_solving",
    });

    expect(newActivity).toBeDefined();
    expect(newActivity.targetAgeBand).toBe("6-7");
    expect(newActivity.evidence.length).toBeGreaterThan(0);
    expect(newActivity.noveltySignature).toBeDefined();
  });
});
