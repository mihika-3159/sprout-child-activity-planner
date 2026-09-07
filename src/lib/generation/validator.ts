/**
 * Activity Validator
 *
 * Before an activity enters a planner, it must pass all validation gates:
 * Evidence → Age → Safety → Materials → Supervision → Duration →
 * Environment → Goal → Novelty → Privacy
 *
 * Per spec section 22.
 */
import type { PlannedActivity, PlannerPreferences } from "../schemas/preferences";
import { redactIdentifyingInformation } from "../privacy/redaction";

export interface ValidationResult {
  passed: boolean;
  failedGates: ValidationGate[];
  warnings: string[];
}

export type ValidationGate =
  | "evidence"
  | "age"
  | "safety"
  | "materials"
  | "supervision"
  | "duration"
  | "environment"
  | "goal"
  | "novelty"
  | "privacy";

// ─── Individual Gate Validators ───────────────────────────────────────────────

/**
 * Evidence gate: Activity must have at least one evidence reference.
 */
function validateEvidence(activity: PlannedActivity): boolean {
  return (
    activity.evidence.length > 0 &&
    activity.evidenceSupport.evidenceChunkIds.length > 0 &&
    activity.evidenceSupport.claimsAllowed.length > 0
  );
}

/**
 * Age gate: Activity must match the selected age band.
 */
function validateAge(activity: PlannedActivity, prefs: PlannerPreferences): boolean {
  return activity.targetAgeBand === prefs.child.ageBand;
}

// Age to number range mapping
const AGE_BAND_RANGES: Record<string, [number, number]> = {
  "2-3": [2, 3],
  "4-5": [4, 5],
  "6-7": [6, 7],
  "8-9": [8, 9],
  "10-12": [10, 12],
  "13+": [13, 18],
};

/**
 * Safety gate: Activities with high supervision requirements cannot be
 * labeled as independent if the age band is too young.
 */
function validateSafety(
  activity: PlannedActivity,
  prefs: PlannerPreferences
): { passed: boolean; warnings: string[] } {
  const warnings: string[] = [];
  const [minAge] = AGE_BAND_RANGES[prefs.child.ageBand] ?? [0, 0];

  // Very young children (2-3) should not have truly unsupervised activities
  if (minAge <= 3 && activity.supervisionLevel === "independent") {
    return {
      passed: false,
      warnings: ["2-3 year olds require at least setup + check-in supervision"],
    };
  }

  // Check for hazardous material mentions in title/description
  const hazardKeywords = [
    "knife", "knives", "boiling", "hot water", "fire", "matches",
    "bleach", "chemical", "electric", "climbing rope", "raw meat",
  ];
  const activityText = `${activity.title} ${activity.description}`.toLowerCase();
  const foundHazards = hazardKeywords.filter((h) => activityText.includes(h));

  if (foundHazards.length > 0) {
    if (activity.supervisionLevel === "independent") {
      return {
        passed: false,
        warnings: [`Activity mentions potential hazards (${foundHazards.join(", ")}) but is labeled independent`],
      };
    }
    warnings.push(`Activity involves potential hazards: ${foundHazards.join(", ")}. Ensure safety notes are present.`);
  }

  // If hazard keywords found, safety notes are required
  if (foundHazards.length > 0 && activity.safetyNotes.length === 0) {
    return {
      passed: false,
      warnings: ["Activity with potential hazards must include safety notes"],
    };
  }

  return { passed: true, warnings };
}

/**
 * Materials gate: Activity materials must be available per preferences.
 */
function validateMaterials(
  activity: PlannedActivity,
  prefs: PlannerPreferences
): boolean {
  if (prefs.householdMaterialsOnly) {
    // Common household items that should always be acceptable
    const householdMaterials = [
      "paper", "pencils", "crayons", "cardboard", "tape", "scissors",
      "books", "containers", "recycled", "cardboard box", "string",
      "water", "playdough", "blocks", "toys", "stuffed animals",
    ];
    // Activity materials should be subset of household materials
    const problematicMaterials = activity.materials.filter(
      (m) => !householdMaterials.some(
        (hm) => m.toLowerCase().includes(hm.toLowerCase())
      )
    );
    return problematicMaterials.length === 0;
  }
  return true;
}

/**
 * Supervision gate: Check supervision level matches parent preference.
 * SAFETY overrides user preference — never force unsafe independence.
 */
function validateSupervision(
  activity: PlannedActivity,
  prefs: PlannerPreferences
): boolean {
  const preferenceToLevels: Record<string, string[]> = {
    fully_independent: ["independent"],
    setup_then_independent: ["independent", "setup_then_independent"],
    occasional_checkin: ["independent", "setup_then_independent", "periodic_checkin"],
    parent_participation_fine: ["independent", "setup_then_independent", "periodic_checkin", "active_supervision"],
  };

  const allowed = preferenceToLevels[prefs.parentInvolvement] ?? ["independent", "setup_then_independent"];
  return allowed.includes(activity.supervisionLevel);
}

/**
 * Duration gate: Activity duration should roughly match requested time.
 */
function validateDuration(
  activity: PlannedActivity,
  prefs: PlannerPreferences
): boolean {
  const durationRanges: Record<string, [number, number]> = {
    "10-15": [5, 25],
    "20-30": [10, 45],
    "30-60": [20, 90],
    "60+": [30, 180],
  };

  const [minMinutes, maxMinutes] = durationRanges[prefs.duration] ?? [0, 180];
  const totalMin = activity.setupMinutes + activity.activityMinutes.min;
  const totalMax = activity.setupMinutes + activity.activityMinutes.max;

  // Activity range should overlap with preferred range
  return totalMin <= maxMinutes && totalMax >= minMinutes;
}

/**
 * Environment gate: Activity must work in the selected environment.
 */
function validateEnvironment(
  activity: PlannedActivity,
  prefs: PlannerPreferences
): boolean {
  const description = activity.description.toLowerCase();
  const isOutdoorActivity =
    description.includes("outdoor") ||
    description.includes("garden") ||
    description.includes("park") ||
    description.includes("outside");

  if (prefs.environment === "indoors" || prefs.environment === "apartment_small_indoor") {
    return !isOutdoorActivity;
  }

  return true; // Other environments allow both indoor and outdoor
}

/**
 * Goal gate: Activity must serve at least one of the requested goals.
 */
function validateGoal(
  activity: PlannedActivity,
  prefs: PlannerPreferences
): boolean {
  const goalToDomains: Record<string, string[]> = {
    independent_play: ["independence", "self_regulation"],
    creativity: ["creativity", "art", "imagination"],
    learning: ["cognitive", "numeracy", "literacy", "science"],
    physical_movement: ["gross_motor", "physical", "movement"],
    quiet_time: ["calm", "mindfulness", "focus"],
    concentration: ["executive_function", "focus", "attention"],
    problem_solving: ["cognitive", "executive_function", "problem_solving"],
    reading_language: ["literacy", "language", "reading"],
    numeracy: ["numeracy", "mathematics"],
    fine_motor: ["fine_motor"],
    imaginative_play: ["imagination", "pretend_play", "creativity"],
    outdoor_activity: ["outdoor", "physical", "nature"],
    winding_down: ["calm", "relaxation", "mindfulness"],
  };

  const requestedDomains = prefs.goals.flatMap(
    (goal) => goalToDomains[goal] ?? []
  );

  if (requestedDomains.length === 0) return true;

  const activityDomains = activity.developmentalDomains.map((d) => d.toLowerCase());
  return requestedDomains.some((d) =>
    activityDomains.some((ad) => ad.includes(d))
  );
}

/**
 * Privacy gate: Generated text should not accidentally reproduce
 * or infer identifying information.
 */
function validatePrivacy(activity: PlannedActivity): boolean {
  const allText = [
    activity.title,
    activity.description,
    ...activity.instructions,
    activity.rationale,
  ].join(" ");

  const result = redactIdentifyingInformation(allText);
  return !result.wasModified; // If redaction changed anything, reject
}

// ─── Main Validator ───────────────────────────────────────────────────────────

/**
 * Run all validation gates on an activity.
 * Any failed critical gate should trigger regeneration.
 */
export function validateActivity(
  activity: PlannedActivity,
  prefs: PlannerPreferences,
  noveltyCheck?: { isNovel: boolean; reason?: string }
): ValidationResult {
  const failedGates: ValidationGate[] = [];
  const warnings: string[] = [];

  // Evidence gate (critical)
  if (!validateEvidence(activity)) {
    failedGates.push("evidence");
  }

  // Age gate (critical)
  if (!validateAge(activity, prefs)) {
    failedGates.push("age");
  }

  // Safety gate (critical — overrides all preferences)
  const safetyResult = validateSafety(activity, prefs);
  if (!safetyResult.passed) {
    failedGates.push("safety");
  }
  warnings.push(...safetyResult.warnings);

  // Materials gate
  if (!validateMaterials(activity, prefs)) {
    failedGates.push("materials");
  }

  // Supervision gate (safety-overriding)
  if (!validateSupervision(activity, prefs)) {
    // Not a hard failure if safety allows it, but should flag
    warnings.push("Activity supervision level doesn't match preference, but safety requirements are met");
  }

  // Duration gate
  if (!validateDuration(activity, prefs)) {
    warnings.push("Activity duration doesn't closely match requested time");
  }

  // Environment gate
  if (!validateEnvironment(activity, prefs)) {
    failedGates.push("environment");
  }

  // Goal gate
  if (!validateGoal(activity, prefs)) {
    warnings.push("Activity doesn't clearly address any requested goal");
  }

  // Novelty gate (critical)
  if (noveltyCheck && !noveltyCheck.isNovel) {
    failedGates.push("novelty");
    if (noveltyCheck.reason) warnings.push(noveltyCheck.reason);
  }

  // Privacy gate (critical)
  if (!validatePrivacy(activity)) {
    failedGates.push("privacy");
    warnings.push("Generated activity text contained potential identifying information");
  }

  return {
    passed: failedGates.length === 0,
    failedGates,
    warnings,
  };
}
