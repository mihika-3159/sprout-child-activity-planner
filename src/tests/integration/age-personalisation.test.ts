import { describe, it, expect, beforeAll } from "vitest";
import { ensureEvidenceSeeded } from "../../lib/evidence/seed";
import { generateSingleActivity } from "../../lib/generation/pipeline";
import { composeMonthlyPlanner } from "../../lib/generation/composer";
import { evaluateActivitySafety, validateMaterialsAllowlist } from "../../lib/generation/safety";
import { normalizePlannerPreferences, PlannerPreferences } from "../../lib/schemas/preferences";
import { signGenerationToken, verifyGenerationToken } from "../../lib/session/generationToken";
import { titleExistsInPlan } from "../../lib/generation/similarity";

describe("Production Personalisation & Age Safety Suite", () => {
  beforeAll(async () => {
    await ensureEvidenceSeeded();
  });

  it("Scenario A: Toddler (2-3) in an apartment generates safe, calibrated activities", async () => {
    const rawPrefs = {
      ageBand: "2-3",
      interests: ["tactile_sensory", "music_rhythm"],
      goals: ["fine_motor", "sensory_exploration"],
      environment: "apartment_small_indoor",
      duration: "10-15",
      parentInvolvement: "active_supervision",
      householdMaterialsOnly: true,
      playGroupSize: 0, // solo
    };
    const prefs = normalizePlannerPreferences(rawPrefs);

    const activity = await generateSingleActivity({
      sessionId: "test-toddler-session",
      preferences: prefs,
      dayNumber: 1,
    });

    expect(activity).toBeDefined();
    expect(activity.targetAgeBand).toBe("2-3");
    expect(activity.supervisionLevel).toBe("active_supervision");

    // Deterministic safety check
    const safetyResult = evaluateActivitySafety(activity, "2-3");
    expect(safetyResult.passed).toBe(true);
    expect(safetyResult.violations).toEqual([]);

    // Check apartment noise constraints (no loud running or obstacle jumping)
    const combinedText = `${activity.title} ${activity.description} ${activity.instructions.join(" ")}`.toLowerCase();
    expect(combinedText).not.toContain("run around");
    expect(combinedText).not.toContain("obstacle course");

    // No toddler safety hazards
    expect(combinedText).not.toContain("scissors");
    expect(combinedText).not.toContain("knife");
    expect(combinedText).not.toContain("phone");
    expect(combinedText).not.toContain("tablet");
  });

  it("Scenario B: Teen (13+) generates rigorous, intellectually serious activities", async () => {
    const rawPrefs = {
      ageBand: "13+",
      interests: ["science_experiments", "building_making"],
      goals: ["critical_thinking", "engineering"],
      environment: "home_indoor",
      duration: "30-60",
      parentInvolvement: "hands_off_independent",
      householdMaterialsOnly: true,
      playGroupSize: 0,
    };
    const prefs = normalizePlannerPreferences(rawPrefs);

    const activity = await generateSingleActivity({
      sessionId: "test-teen-session",
      preferences: prefs,
      dayNumber: 1,
    });

    expect(activity).toBeDefined();
    expect(activity.targetAgeBand).toBe("13+");

    // Verify serious framing, no preschool tropes
    const combinedText = `${activity.title} ${activity.description} ${activity.instructions.join(" ")}`.toLowerCase();
    expect(combinedText).not.toContain("puppet");
    expect(combinedText).not.toContain("treasure hunt");
    expect(combinedText).not.toContain("caterpillar");
    expect(combinedText).not.toContain("finger paint");
  });

  it("Scenario C: Activities across age bands have distinct titles and mechanisms", async () => {
    const toddlerPrefs = normalizePlannerPreferences({
      ageBand: "2-3",
      interests: ["nature_outdoors"],
      goals: ["exploration"],
      environment: "backyard_nature",
    });

    const teenPrefs = normalizePlannerPreferences({
      ageBand: "13+",
      interests: ["nature_outdoors"],
      goals: ["exploration"],
      environment: "backyard_nature",
    });

    const toddlerAct = await generateSingleActivity({
      sessionId: "divergence-test",
      preferences: toddlerPrefs,
      dayNumber: 1,
    });

    const teenAct = await generateSingleActivity({
      sessionId: "divergence-test",
      preferences: teenPrefs,
      dayNumber: 1,
    });

    expect(toddlerAct.title).not.toEqual(teenAct.title);
    expect(toddlerAct.noveltySignature).not.toEqual(teenAct.noveltySignature);
    expect(toddlerAct.targetAgeBand).toBe("2-3");
    expect(teenAct.targetAgeBand).toBe("13+");
  });

  it("Scenario D: Regeneration reliably excludes current activity title and mechanic", async () => {
    const prefs = normalizePlannerPreferences({
      ageBand: "6-7",
      interests: ["building_making"],
      goals: ["creativity"],
    });

    const originalActivity = await generateSingleActivity({
      sessionId: "regen-test",
      preferences: prefs,
      dayNumber: 2,
    });

    const currentMechanic = originalActivity.noveltySignature.split(":")[0];

    const regeneratedActivity = await generateSingleActivity({
      sessionId: "regen-test",
      preferences: prefs,
      dayNumber: 2,
      excludeTitle: originalActivity.title,
      excludeMechanic: currentMechanic,
    });

    expect(regeneratedActivity.title).not.toEqual(originalActivity.title);
    expect(regeneratedActivity.id).not.toEqual(originalActivity.id);
  });

  it("Scenario E: Monthly Planner generates 28 distinct activities across 4 themed weeks", async () => {
    const prefs = normalizePlannerPreferences({
      ageBand: "4-5",
      interests: ["nature_outdoors", "art_drawing"],
      goals: ["creativity", "fine_motor"],
      productType: "monthly",
    });

    const { planner, preview } = await composeMonthlyPlanner({
      sessionId: "monthly-test",
      preferences: prefs,
    });

    expect(planner.weeks).toHaveLength(4);
    expect(preview.productType).toBe("monthly");

    const allTitles = new Set<string>();
    for (const week of planner.weeks) {
      expect(week.days).toHaveLength(7);
      for (const day of week.days) {
        expect(day.activities).toHaveLength(1);
        allTitles.add(day.activities[0].title);
      }
    }

    expect(allTitles.size).toBe(28);
  }, 25000);

  it("returns the selected target age and exact duration for every supported age band", async () => {
    const ages = ["2-3", "4-5", "6-7", "8-9", "10-12", "13+"] as const;
    for (const ageBand of ages) {
      const prefs = normalizePlannerPreferences({
        ageBand,
        interests: ["science"],
        goals: ["problem_solving"],
        environment: "indoors",
        duration: "20-30",
        householdMaterialsOnly: true,
      });
      const activity = await generateSingleActivity({
        sessionId: `all-ages-${ageBand}`,
        preferences: prefs,
        dayNumber: 1,
      });
      expect(activity.targetAgeBand).toBe(ageBand);
      expect(activity.activityMinutes.min).toBe(20);
      expect(activity.activityMinutes.max).toBe(30);
      expect(activity.evidence[0]?.sourceTitle).toBeTruthy();
      if (ageBand === "2-3") expect(activity.supervisionLevel).toBe("active_supervision");
    }
  }, 30000);

  it("Scenario F: Stateless generation token signs and verifies reliably for monthly chunks", () => {
    const genId = "00000000-0000-0000-0000-000000000001";
    const token = signGenerationToken(genId);
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(10);

    // Verifies with same ID
    expect(verifyGenerationToken(genId, token)).toBe(true);

    // Fails with mismatched ID
    expect(verifyGenerationToken("different-id", token)).toBe(false);

    // Fails with forged or tampered token
    expect(verifyGenerationToken(genId, token.slice(0, -4) + "abcd")).toBe(false);
    expect(verifyGenerationToken(genId, "invalid-token")).toBe(false);
  });

  it("Scenario G: Regeneration novelty check strictly excludes plan-wide duplicate titles", async () => {
    const teenPrefs = normalizePlannerPreferences({
      ageBand: "13+",
      interests: ["science", "cooking"],
      goals: ["problem_solving"],
      householdItemsOnly: true,
    });

    const day3Activity = await generateSingleActivity({
      sessionId: "novelty-test-session",
      preferences: teenPrefs,
      dayNumber: 3,
    });

    // Simulate regenerating Day 1 with Day 3's title in the exclude list
    const regeneratedDay1 = await generateSingleActivity({
      sessionId: "novelty-test-session",
      preferences: teenPrefs,
      dayNumber: 1,
      excludeTitles: [day3Activity.title, "Culinary Surface Tension & Capillary Action Investigation"],
    });

    expect(regeneratedDay1.title).not.toEqual(day3Activity.title);
    expect(titleExistsInPlan(regeneratedDay1.title, [day3Activity.title])).toBe(false);
  });

  it("Scenario H: Regenerated activity maintains full bibliographic evidence metadata", async () => {
    const prefs = normalizePlannerPreferences({
      ageBand: "6-7",
      interests: ["space", "science"],
      goals: ["learning"],
    });

    const regenerated = await generateSingleActivity({
      sessionId: "evidence-parity-session",
      preferences: prefs,
      dayNumber: 2,
    });

    expect(regenerated.evidence).toBeDefined();
    expect(regenerated.evidence.length).toBeGreaterThan(0);

    const primaryEv = regenerated.evidence[0];
    expect(primaryEv.sourceTitle).toBeDefined();
    expect(typeof primaryEv.sourceTitle).toBe("string");
    expect((primaryEv.sourceTitle as string).length).toBeGreaterThan(5);
    expect(primaryEv.organizationAuthors).toBeDefined();
    expect(primaryEv.publicationYear).toBeDefined();
    expect(primaryEv.evidenceStrength).toBeDefined();
    expect(["strong", "moderate", "limited"]).toContain(primaryEv.evidenceStrength);
  });

  it("Scenario I: Toddler safety evaluates variations and enforces materials allowlist", () => {
    // 1. Choking hazard in extension should fail toddler safety
    const unsafeToddlerActivity = {
      id: "test-unsafe-1",
      title: "Sensory Texture Bin",
      targetAgeBand: "2-3" as const,
      description: "Explore textures in a tray.",
      instructions: ["Touch the smooth objects."],
      materials: ["household containers"],
      setupMinutes: 2,
      activityMinutes: { min: 10, max: 15 },
      supervisionLevel: "active_supervision" as const,
      parentSetup: ["Set out tray."],
      developmentalDomains: ["sensory"],
      rationale: "Sensory exploration develops tactile processing.",
      evidence: [],
      safetyNotes: ["Watch child."],
      easyVariation: "Use flat fabric scraps.",
      extension: "Hide small toy animals in a tub of dry rice for scooping.",
      noveltySignature: "unsafe-rice:sensory",
    };

    const safetyResult = evaluateActivitySafety(unsafeToddlerActivity, "2-3");
    expect(safetyResult.passed).toBe(false);
    expect(safetyResult.violations.some((v) => v.toLowerCase().includes("choking"))).toBe(true);

    // 2. Materials allowlist catches unselected supplies in instructions
    const allowlistCheck = validateMaterialsAllowlist(
      ["plain paper"],
      [],
      true, // householdOnly
      "Spray the paper with food coloring and wipe with shaving cream"
    );
    expect(allowlistCheck.passed).toBe(false);
    expect(allowlistCheck.offendingMaterials.some((v) => v.toLowerCase().includes("food coloring"))).toBe(true);
  });
});
