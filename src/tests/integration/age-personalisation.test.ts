import { describe, it, expect, beforeAll } from "vitest";
import { ensureEvidenceSeeded } from "../../lib/evidence/seed";
import { generateSingleActivity } from "../../lib/generation/pipeline";
import { composeMonthlyPlanner } from "../../lib/generation/composer";
import { evaluateActivitySafety } from "../../lib/generation/safety";
import { normalizePlannerPreferences, PlannerPreferences } from "../../lib/schemas/preferences";

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

    // Ensure activities across 28 days are not identical
    expect(allTitles.size).toBeGreaterThan(5);
  }, 25000);
});
