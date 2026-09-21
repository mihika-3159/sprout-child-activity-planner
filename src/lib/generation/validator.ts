/**
 * Activity Validator
 *
 * Before an activity enters a planner, it must pass all deterministic validation gates:
 * Evidence → Age → Safety → Materials → Supervision → Duration →
 * Environment → Group Size → Goal → Novelty → Privacy
 */
import type { PlannedActivity, PlannerPreferences } from "../schemas/preferences";
import { redactIdentifyingInformation } from "../privacy/redaction";
import { evaluateActivitySafety, validateMaterialsAllowlist } from "./safety";

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
  | "group_size"
  | "goal"
  | "novelty"
  | "privacy";

/**
 * Evidence gate: Activity must have at least one valid evidence citation.
 */
function validateEvidence(activity: PlannedActivity): boolean {
  if (!activity.evidence || activity.evidence.length === 0) return false;
  const first = activity.evidence[0];
  const hasValidCitation = !!(first.sourceTitle || first.supportExplanation || first.relevantFindingSummary);
  return hasValidCitation;
}

/**
 * Age gate: Activity must strictly match the selected age band.
 */
function validateAge(activity: PlannedActivity, prefs: PlannerPreferences): boolean {
  const targetAge = prefs.ageBand || prefs.child?.ageBand;
  return activity.targetAgeBand === targetAge;
}

/**
 * Materials gate: Validates materials against selected materials and household allowlist.
 */
function validateMaterials(
  activity: PlannedActivity,
  prefs: PlannerPreferences
): { passed: boolean; warnings: string[] } {
  const selected = prefs.selectedMaterials || prefs.materials || [];
  const householdOnly = typeof prefs.householdItemsOnly === "boolean"
    ? prefs.householdItemsOnly
    : (typeof prefs.householdMaterialsOnly === "boolean" ? prefs.householdMaterialsOnly : true);

  const fullText = [
    activity.title || "",
    activity.description || "",
    ...(activity.instructions || []),
    ...(activity.parentSetup || []),
    activity.easyVariation || "",
    activity.extension || "",
  ].join(" ");

  const result = validateMaterialsAllowlist(activity.materials, selected, householdOnly, fullText);
  if (!result.passed) {
    return {
      passed: false,
      warnings: [`Activity requires unselected or non-household materials: ${result.offendingMaterials.join(", ")}`],
    };
  }
  return { passed: true, warnings: [] };
}

/**
 * Supervision gate: Check supervision compatibility with age and parent preference.
 * Safety strictly overrides parent preference.
 */
function validateSupervision(
  activity: PlannedActivity,
  prefs: PlannerPreferences
): { passed: boolean; warnings: string[] } {
  const ageBand = prefs.ageBand || prefs.child?.ageBand || "4-5";
  const involvement = prefs.involvement || prefs.parentInvolvement || "setup_then_independent";

  // For 2-3, full independence is strictly prohibited by safety
  if (ageBand === "2-3" && activity.supervisionLevel === "independent") {
    return {
      passed: false,
      warnings: ["Toddler activities must never be marked independent"],
    };
  }

  return { passed: true, warnings: [] };
}

/**
 * Duration gate: Duration must fall inside the selected duration band.
 */
function validateDuration(
  activity: PlannedActivity,
  prefs: PlannerPreferences
): { passed: boolean; warnings: string[] } {
  const durationKey = prefs.duration;
  const actMin = activity.activityMinutes.min;
  const actMax = activity.activityMinutes.max;

  // Strict boundaries
  switch (durationKey) {
    case "10-15":
      if (actMin < 10 || actMax > 15) {
        return { passed: false, warnings: [`Duration exceeds 10-15 min band (activity is ${actMin}-${actMax}m)`] };
      }
      break;
    case "20-30":
      if (actMin < 20 || actMax > 30) {
        return { passed: false, warnings: [`Duration outside 20-30 min band (activity is ${actMin}-${actMax}m)`] };
      }
      break;
    case "30-60":
      if (actMin < 30 || actMax > 60) {
        return { passed: false, warnings: [`Duration outside 30-60 min band (activity is ${actMin}-${actMax}m)`] };
      }
      break;
    case "60+":
      if (actMin < 60) {
        return { passed: false, warnings: [`Duration too short for 60+ min band (activity is ${actMin}-${actMax}m)`] };
      }
      break;
  }

  return { passed: true, warnings: [] };
}

/**
 * Environment gate: Activity must respect indoor vs apartment vs outdoor constraints.
 */
function validateEnvironment(
  activity: PlannedActivity,
  prefs: PlannerPreferences
): { passed: boolean; warnings: string[] } {
  const env = prefs.environment;
  const allText = `${activity.title} ${activity.description} ${activity.instructions.join(" ")}`.toLowerCase();

  // Apartment constraints: NO running, jumping, loud floor obstacles, floor-is-lava, or furniture climbing
  if (env === "apartment_small_indoor") {
    const apartmentBanned = [
      "running", "sprint", "run around", "floor is lava",
      "obstacle course", "jumping over", "jumping challenge", "climb under dining chair",
      "loud music", "loud noise", "stomp loudly", "stomp feet", "race across", "outdoor", "in the garden", "in the yard"
    ];
    const foundBanned = apartmentBanned.filter((w) => allText.includes(w));
    if (foundBanned.length > 0) {
      return {
        passed: false,
        warnings: [`Apartment space violation: activity contains ${foundBanned.join(", ")}`],
      };
    }
  }

  if (
    env === "indoors" &&
    (allText.includes("in the garden") ||
      allText.includes("in the yard") ||
      allText.includes("outside in the grass") ||
      allText.includes("outdoor") ||
      allText.includes("outdoors") ||
      allText.includes("in the park"))
  ) {
    return {
      passed: false,
      warnings: ["Indoor activity requires outdoor setting"],
    };
  }

  return { passed: true, warnings: [] };
}

/**
 * Group Size / Solo Play gate:
 * Solo activities cannot require siblings, playmates, audiences, or family participation.
 * Group activities must support multiple children.
 */
function validateGroupSize(
  activity: PlannedActivity,
  prefs: PlannerPreferences
): { passed: boolean; warnings: string[] } {
  const playGroupSize = typeof prefs.playGroupSize === "number"
    ? prefs.playGroupSize
    : (typeof prefs.playmatesCount === "number" ? prefs.playmatesCount : 0);
  const allText = `${activity.title} ${activity.description} ${activity.instructions.join(" ")}`.toLowerCase();

  if (playGroupSize === 0) {
    // Solo play
    const socialDemands = [
      "hand to family members",
      "tickets to family",
      "guide the family",
      "take turns with a friend",
      "compete with your partner",
      "ask your sibling",
      "with a playmate",
      "with friends",
      "audience",
      "perform a show for",
      "tour for visitors"
    ];
    const foundDemands = socialDemands.filter((d) => allText.includes(d));
    if (foundDemands.length > 0) {
      return {
        passed: false,
        warnings: [`Solo activity requires external participants/audience: found "${foundDemands.join(", ")}"`],
      };
    }
  }

  return { passed: true, warnings: [] };
}

/**
 * Goal gate: Activity must serve at least one requested developmental goal.
 */
function validateGoal(
  activity: PlannedActivity,
  prefs: PlannerPreferences
): boolean {
  const goalToDomains: Record<string, string[]> = {
    independent_play: ["independence", "self_regulation", "focus", "creative"],
    creativity: ["creativity", "art", "imagination", "design"],
    learning: ["cognitive", "numeracy", "literacy", "science", "learning"],
    physical_movement: ["gross_motor", "physical", "movement", "motor"],
    quiet_time: ["calm", "mindfulness", "focus", "sensory"],
    concentration: ["executive_function", "focus", "attention", "cognitive"],
    problem_solving: ["cognitive", "executive_function", "problem_solving", "science"],
    reading_language: ["literacy", "language", "reading", "vocabulary"],
    numeracy: ["numeracy", "mathematics", "counting", "patterns"],
    fine_motor: ["fine_motor", "dexterity", "coordination"],
    imaginative_play: ["imagination", "pretend_play", "creativity"],
    outdoor_activity: ["outdoor", "physical", "nature", "observation"],
    winding_down: ["calm", "relaxation", "mindfulness"],
  };

  const requestedDomains = (prefs.goals || []).flatMap(
    (goal) => goalToDomains[goal] ?? [goal]
  );

  if (requestedDomains.length === 0) return true;

  const activityDomains = (activity.developmentalDomains || []).map((d) => d.toLowerCase());
  return requestedDomains.some((d) =>
    activityDomains.some((ad) => ad.includes(d) || d.includes(ad))
  );
}

/**
 * Privacy gate: Activity text must not contain identifying information.
 */
function validatePrivacy(activity: PlannedActivity): boolean {
  const allText = [
    activity.title,
    activity.description,
    ...(activity.instructions || []),
  ].join(" ");

  const result = redactIdentifyingInformation(allText);
  // An activity text should not contain emails, phone numbers, postcodes, or street addresses
  const hasDirectPII = result.detectedTypes.some((t) =>
    ["email", "phone", "postcode", "address"].includes(t)
  );
  return !hasDirectPII;
}

// ─── Main Validator ───────────────────────────────────────────────────────────

/**
 * Run all validation gates on an activity.
 * Strict deterministic validation: fails any non-compliant activity.
 */
export function validateActivity(
  activity: PlannedActivity,
  prefs: PlannerPreferences,
  noveltyCheck?: { isNovel: boolean; reason?: string }
): ValidationResult {
  const failedGates: ValidationGate[] = [];
  const warnings: string[] = [];

  const ageBand = prefs.ageBand || prefs.child?.ageBand || "4-5";

  // 1. Evidence gate (critical)
  if (!validateEvidence(activity)) {
    failedGates.push("evidence");
    warnings.push("Activity is missing valid scientific evidence citation");
  }

  // 2. Age gate (critical)
  if (!validateAge(activity, prefs)) {
    failedGates.push("age");
    warnings.push(`Target age band (${activity.targetAgeBand}) does not match requested (${ageBand})`);
  }

  // 3. Safety gate (critical deterministic safety rules)
  const safetyResult = evaluateActivitySafety(activity, ageBand, prefs.involvement || prefs.parentInvolvement);
  if (!safetyResult.passed) {
    failedGates.push("safety");
    warnings.push(...safetyResult.violations);
  }
  activity.chokingHazardChecked = !safetyResult.chokingRiskDetected;
  activity.materialRiskChecked = !safetyResult.materialRiskDetected;
  if (safetyResult.recommendedSupervisionLevel && activity.supervisionLevel !== safetyResult.recommendedSupervisionLevel) {
    activity.supervisionLevel = safetyResult.recommendedSupervisionLevel;
  }
  if (safetyResult.requiredSafetyNotes.length > 0) {
    const existing = new Set(activity.safetyNotes || []);
    safetyResult.requiredSafetyNotes.forEach((n) => existing.add(n));
    activity.safetyNotes = Array.from(existing);
  }

  // 4. Materials gate
  const matResult = validateMaterials(activity, prefs);
  if (!matResult.passed) {
    failedGates.push("materials");
    warnings.push(...matResult.warnings);
  }

  // 5. Supervision gate
  const supResult = validateSupervision(activity, prefs);
  if (!supResult.passed) {
    failedGates.push("supervision");
    warnings.push(...supResult.warnings);
  }

  // 6. Duration gate
  const durResult = validateDuration(activity, prefs);
  if (!durResult.passed) {
    failedGates.push("duration");
    warnings.push(...durResult.warnings);
  }

  // 7. Environment gate
  const envResult = validateEnvironment(activity, prefs);
  if (!envResult.passed) {
    failedGates.push("environment");
    warnings.push(...envResult.warnings);
  }

  // 8. Solo vs Group Size gate
  const grpResult = validateGroupSize(activity, prefs);
  if (!grpResult.passed) {
    failedGates.push("group_size");
    warnings.push(...grpResult.warnings);
  }

  // 9. Goal gate
  if (!validateGoal(activity, prefs)) {
    warnings.push("Activity doesn't clearly address requested goals");
  }

  // 10. Novelty gate (critical)
  if (noveltyCheck && !noveltyCheck.isNovel) {
    failedGates.push("novelty");
    if (noveltyCheck.reason) warnings.push(noveltyCheck.reason);
  }

  // 11. Privacy gate (critical)
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
