import { describe, it, expect } from "vitest";
import { validateActivity } from "../../lib/generation/validator";
import { PlannedActivity, PlannerPreferences } from "../../lib/schemas/preferences";

describe("Activity Validation Gates (Spec Section 22)", () => {
  const basePreferences: PlannerPreferences = {
    child: { ageBand: "4-5", numberOfChildren: 1, additionalChildAgeBands: [] },
    interests: ["animals", "art"],
    customInterests: [],
    goals: ["independent_play", "creativity"],
    environment: "indoors",
    duration: "20-30",
    parentInvolvement: "setup_then_independent",
    prepTolerance: "under_5_min",
    materials: ["paper", "pencils_crayons", "cardboard"],
    householdMaterialsOnly: false,
    energyLevel: "moderate",
    activitiesPerDay: 1,
    productType: "weekly",
    playmatesCount: 0,
  };

  const validActivity: PlannedActivity = {
    id: "act-1",
    title: "Cardboard Jungle Safari",
    targetAgeBand: "4-5",
    description: "Draw and cut out simple animal shapes, then set up a small jungle scene on the floor.",
    instructions: ["Draw animals on cardboard", "Colour them in", "Stand them up in an egg carton"],
    materials: ["cardboard", "pencils_crayons"],
    setupMinutes: 2,
    activityMinutes: { min: 15, max: 25 },
    supervisionLevel: "setup_then_independent",
    parentSetup: ["Help cut the cardboard if needed"],
    developmentalDomains: ["creativity", "fine_motor"],
    rationale: "Supports fine motor grasping and creative spatial imagination.",
    evidence: [
      {
        sourceIds: ["cdc-milestones"],
        chunkIds: ["cdc-fine-motor-1"],
        supportExplanation: "Grounded in CDC evidence-based motor milestones.",
      },
    ],
    safetyNotes: ["Use blunt child safety scissors."],
    easyVariation: "Use paper if cardboard is too stiff to cut.",
    extension: "Draw food or trees for the animals.",
    noveltySignature: "concept-1:cardboard,safari",
    evidenceSupport: {
      evidenceChunkIds: ["cdc-fine-motor-1"],
      supportedDomains: ["fine_motor", "creativity"],
      evidenceStrength: "strong",
      claimsAllowed: ["fine_motor", "creativity"],
    },
  };

  it("passes completely for compliant evidence-grounded activities", () => {
    const result = validateActivity(validActivity, basePreferences);
    expect(result.passed).toBe(true);
    expect(result.failedGates.length).toBe(0);
  });

  it("fails the age gate when target age band mismatches child age", () => {
    const wrongAgeActivity = { ...validActivity, targetAgeBand: "10-12" as const };
    const result = validateActivity(wrongAgeActivity, basePreferences);
    expect(result.passed).toBe(false);
    expect(result.failedGates).toContain("age");
  });

  it("fails the evidence gate when evidence citations are missing", () => {
    const ungroundedActivity = {
      ...validActivity,
      evidence: [],
      evidenceSupport: {
        evidenceChunkIds: [],
        supportedDomains: [],
        claimsAllowed: [],
      },
    };
    const result = validateActivity(ungroundedActivity, basePreferences);
    expect(result.passed).toBe(false);
    expect(result.failedGates).toContain("evidence");
  });

  it("fails the safety gate if young toddler (2-3) activity claims 100% independence without supervision", () => {
    const toddlerPrefs: PlannerPreferences = {
      ...basePreferences,
      child: { ageBand: "2-3", numberOfChildren: 1, additionalChildAgeBands: [] },
    };
    const unsafeActivity: PlannedActivity = {
      ...validActivity,
      targetAgeBand: "2-3",
      supervisionLevel: "independent",
    };
    const result = validateActivity(unsafeActivity, toddlerPrefs);
    expect(result.passed).toBe(false);
    expect(result.failedGates).toContain("safety");
  });
});
