/**
 * Deterministic Safety Validation Layer (Spec Section 2)
 *
 * Runs after generation and before any activity is stored or presented.
 * Safety is completely deterministic and NEVER relies solely on LLM compliance.
 */
import { AgeBand, SupervisionLevel, PlannedActivity, PlannerPreferences } from "../schemas/preferences";

export interface SafetyCheckResult {
  passed: boolean;
  violations: string[];
  chokingRiskDetected: boolean;
  materialRiskDetected: boolean;
  recommendedSupervisionLevel?: SupervisionLevel;
  requiredSafetyNotes: string[];
}

// Low-risk whitelist for Age 2-3 allowing "setup_then_independent"
const TODDLER_INDEPENDENT_WHITELIST_KEYWORDS = [
  "soft towel",
  "cushion",
  "large box",
  "large plastic bowl",
  "stacking cups",
  "rolling large ball",
  "stomp",
  "crawling path",
  "fabric scraps",
];

// Age 2-3 Prohibited Materials (Choking, Sharps, Hazards)
const TODDLER_CHOKING_HAZARDS = [
  "coin",
  "coins",
  "button",
  "buttons",
  "bead",
  "beads",
  "marble",
  "marbles",
  "small ball",
  "small balls",
  "ping pong",
  "ping-pong",
  "plastic egg",
  "plastic eggs",
  "loose magnet",
  "magnet",
  "magnets",
  "battery",
  "batteries",
  "balloon",
  "balloons",
  "tiny paper",
  "small paper scrap",
  "dry bean",
  "dried beans",
  "uncooked rice",
  "dry rice",
  "rice",
  "pasta",
  "dry pasta",
  "raw pasta",
  "large pasta",
  "small pebble",
  "grape",
  "nut",
  "choking",
];

const TODDLER_PROHIBITED_MATERIALS = [
  ...TODDLER_CHOKING_HAZARDS,
  "scissors",
  "scissor",
  "shears",
  "sharp pencil",
  "hot water",
  "boiling",
  "stove",
  "oven",
  "microwave",
  "cooking appliance",
  "hot item",
  "glass",
  "chemical",
  "bleach",
  "detergent",
  "cord",
  "cords",
  "string longer than 12 inches",
  "plastic bag",
  "plastic bags",
  "standing water",
  "bucket of water",
  "bathtub",
];

const TODDLER_PROHIBITED_ACTIONS = [
  "take photo",
  "take a photo",
  "photograph",
  "phone",
  "smartphone",
  "record video",
  "voice recorder",
  "recording",
  "flashlight",
  "torch",
  "dark room",
  "dim the lights",
  "lights off",
  "climb",
  "climbing chair",
  "climbing table",
  "furniture obstacle",
  "unstable structure",
  "handwrite",
  "handwriting",
  "write a story",
  "write sentences",
  "read the clues",
  "read instructions",
  "detailed drawing",
  "precise cutting",
  "cut out",
  "complex folding",
  "origami",
  "multi-step construction",
];

// Universal hazards for young children under 8
const GENERAL_HAZARDS = [
  "knife",
  "knives",
  "razor",
  "box cutter",
  "exacto",
  "match",
  "matches",
  "lighter",
  "fire",
  "flame",
  "bleach",
  "ammonia",
  "hot stove",
  "boiling water",
  "raw meat",
];

/**
 * Checks text content against forbidden word stems
 */
function findKeywords(text: string, list: string[]): string[] {
  const lower = text.toLowerCase();
  return list.filter((keyword) => {
    // Word-boundary aware or clean phrase matching
    const regex = new RegExp(`\\b${keyword.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "i");
    return regex.test(lower) || lower.includes(keyword.toLowerCase());
  });
}

/**
 * Evaluates an activity against strict age-based safety constraints.
 */
export function evaluateActivitySafety(
  activity: Partial<PlannedActivity>,
  ageBand: AgeBand,
  parentInvolvementPreference?: string
): SafetyCheckResult {
  const allText = [
    activity.title || "",
    activity.description || "",
    ...(activity.instructions || []),
    ...(activity.materials || []),
    ...(activity.parentSetup || []),
    activity.easyVariation || "",
    activity.extension || "",
  ].join(" ");

  const violations: string[] = [];
  let chokingRiskDetected = false;
  let materialRiskDetected = false;
  let recommendedSupervision: SupervisionLevel = activity.supervisionLevel || "setup_then_independent";
  const requiredSafetyNotes: string[] = [...(activity.safetyNotes || [])];

  // ─── AGE 2-3 HARD SAFETY RULES ──────────────────────────────────────────────
  if (ageBand === "2-3") {
    // 1. Choking risk audit
    const foundChoking = findKeywords(allText, TODDLER_CHOKING_HAZARDS);
    if (foundChoking.length > 0) {
      chokingRiskDetected = true;
      violations.push(`Age 2-3 prohibits choking hazards: found ${foundChoking.join(", ")}`);
    }

    // 2. Prohibited materials audit
    const foundMaterials = findKeywords(allText, TODDLER_PROHIBITED_MATERIALS);
    if (foundMaterials.length > 0) {
      materialRiskDetected = true;
      violations.push(`Age 2-3 prohibits hazardous materials: found ${foundMaterials.join(", ")}`);
    }

    // 3. Prohibited actions audit
    const foundActions = findKeywords(allText, TODDLER_PROHIBITED_ACTIONS);
    if (foundActions.length > 0) {
      violations.push(`Age 2-3 prohibits complex/unsafe actions: found ${foundActions.join(", ")}`);
    }

    // 4. Maximum instruction steps for toddlers is 4
    if (activity.instructions && activity.instructions.length > 4) {
      violations.push(`Age 2-3 activity has too many instruction steps (${activity.instructions.length}, maximum is 4)`);
    }

    // 5. Supervision escalation: Defaults to active adult supervision
    const isWhitelisted = TODDLER_INDEPENDENT_WHITELIST_KEYWORDS.some((kw) =>
      allText.toLowerCase().includes(kw)
    );

    if (activity.supervisionLevel === "independent") {
      violations.push("Age 2-3 activities must never be marked fully independent");
      recommendedSupervision = isWhitelisted ? "setup_then_independent" : "active_supervision";
    } else if (activity.supervisionLevel === "setup_then_independent" && !isWhitelisted) {
      // Must escalate to active supervision if not on low-risk whitelist
      recommendedSupervision = "active_supervision";
      requiredSafetyNotes.push("Continuous adult supervision required for this toddler activity.");
    } else {
      recommendedSupervision = activity.supervisionLevel || "active_supervision";
    }

    if (!requiredSafetyNotes.some((n) => n.toLowerCase().includes("supervis"))) {
      requiredSafetyNotes.push("Active adult supervision is recommended for children aged 2–3.");
    }
  }

  // ─── AGES 4-5 SAFETY RULES ──────────────────────────────────────────────────
  if (ageBand === "4-5") {
    const generalFound = findKeywords(allText, GENERAL_HAZARDS);
    if (generalFound.length > 0) {
      materialRiskDetected = true;
      violations.push(`Ages 4-5 prohibits hazardous items: ${generalFound.join(", ")}`);
    }

    const chokingFound = findKeywords(allText, ["small loose magnet", "button battery", "raw chemicals"]);
    if (chokingFound.length > 0) {
      chokingRiskDetected = true;
      violations.push(`Ages 4-5 prohibits high risk choking items: ${chokingFound.join(", ")}`);
    }

    // Scissors check: must be explicitly child-safe scissors
    if (allText.toLowerCase().includes("scissors") && !allText.toLowerCase().includes("child-safe") && !allText.toLowerCase().includes("safety scissors") && !allText.toLowerCase().includes("blunt")) {
      violations.push("Ages 4-5 scissors must be specified as child-safe blunt scissors");
    }

    if (activity.supervisionLevel === "independent") {
      recommendedSupervision = "setup_then_independent";
    }
  }

  // ─── AGES 6-7 & 8-9 SAFETY RULES ────────────────────────────────────────────
  if (ageBand === "6-7" || ageBand === "8-9") {
    const dangerousFound = findKeywords(allText, ["knife", "knives", "fire", "lighter", "boiling water", "bleach"]);
    if (dangerousFound.length > 0) {
      materialRiskDetected = true;
      violations.push(`Unsupervised hazardous tools detected for ages ${ageBand}: ${dangerousFound.join(", ")}`);
    }
  }

  // ─── ALL AGES: GENERAL HAZARD CHECK ─────────────────────────────────────────
  const lethalFound = findKeywords(allText, ["sharp blade", "power tool", "caustic", "toxic chemical"]);
  if (lethalFound.length > 0) {
    violations.push(`Prohibited dangerous equipment found: ${lethalFound.join(", ")}`);
  }

  return {
    passed: violations.length === 0,
    violations,
    chokingRiskDetected,
    materialRiskDetected,
    recommendedSupervisionLevel: recommendedSupervision,
    requiredSafetyNotes,
  };
}

/**
 * Validates household materials allowlist.
 * If householdItemsOnly is true, materials must strictly reside in the household basics allowlist
 * or have been explicitly selected by the parent.
 */
export function validateMaterialsAllowlist(
  activityMaterials: string[],
  selectedMaterials: string[],
  householdOnly: boolean,
  activityText?: string
): { passed: boolean; offendingMaterials: string[] } {
  if (!householdOnly) {
    return { passed: true, offendingMaterials: [] };
  }

  // Clean household basics that homes generally have without buying special craft supplies
  const HOUSEHOLD_BASICS_ALLOWLIST = [
    "paper",
    "plain paper",
    "scrap paper",
    "cardboard",
    "cardboard box",
    "cardboard boxes",
    "crayons",
    "pencils",
    "pencils and crayons",
    "pencils_crayons",
    "pencil",
    "pen",
    "water",
    "water basin",
    "cup",
    "cups",
    "plastic bowl",
    "bowl",
    "bowls",
    "spoon",
    "spoons",
    "towel",
    "towels",
    "cushion",
    "cushions",
    "pillow",
    "books",
    "picture books",
    "storybooks",
    "container",
    "containers",
    "household_containers",
    "recycled_materials",
    "clean cardboard tube",
    "leaves",
    "twigs",
    "stones",
    "outdoor_natural",
  ];

  // Items that are strictly SPECIAL and CANNOT be assumed unless explicitly selected by parent
  const SPECIAL_SUPPLIES_PROHIBITED = [
    "scissors",
    "child_safe_scissors",
    "glue",
    "glue stick",
    "craft glue",
    "tape",
    "masking tape",
    "painter's tape",
    "sticky tape",
    "scotch tape",
    "food colouring",
    "food coloring",
    "flashlight",
    "torch",
    "dropper",
    "pipette",
    "spray bottle",
    "glitter",
    "pipe cleaner",
    "craft_supplies",
    "oil",
    "cooking oil",
    "vegetable oil",
    "dish soap",
    "soap",
    "mustard",
    "honey",
    "milk",
    "food scraps",
    "dry rice",
    "uncooked rice",
    "rice",
    "pasta",
    "dry pasta",
    "string",
    "yarn",
    "cleaning sponge",
    "sponge",
  ];

  const selectedLower = selectedMaterials.map((m) => m.toLowerCase().replace(/_/g, " "));
  const offending: string[] = [];

  for (const rawMat of activityMaterials) {
    const mat = rawMat.toLowerCase().trim().replace(/_/g, " ");

    // Check if directly in selected materials
    const isExplicitlySelected = selectedLower.some((sel) => mat.includes(sel) || sel.includes(mat));
    if (isExplicitlySelected) continue;

    // Check if it is an unselected special supply
    const isSpecial = SPECIAL_SUPPLIES_PROHIBITED.some((spec) => {
      const cleanSpec = spec.toLowerCase().replace(/_/g, " ");
      return mat.includes(cleanSpec) || cleanSpec.includes(mat);
    });
    if (isSpecial) {
      offending.push(rawMat);
      continue;
    }

    // Check if in standard household basics allowlist
    const isHouseholdBasic = HOUSEHOLD_BASICS_ALLOWLIST.some((base) => {
      const cleanBase = base.toLowerCase().replace(/_/g, " ");
      return mat.includes(cleanBase) || cleanBase.includes(mat);
    });
    if (!isHouseholdBasic) {
      offending.push(rawMat);
    }
  }

  // Scan activity full text for unselected prohibited materials introduced in instructions
  if (activityText) {
    const textLower = activityText.toLowerCase();
    for (const spec of SPECIAL_SUPPLIES_PROHIBITED) {
      const cleanSpec = spec.toLowerCase().replace(/_/g, " ");
      const isSelected = selectedLower.some((sel) => cleanSpec.includes(sel) || sel.includes(cleanSpec));
      if (!isSelected) {
        const regex = new RegExp(`\\b${cleanSpec.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "i");
        if (regex.test(textLower)) {
          if (!offending.includes(spec)) {
            offending.push(spec);
          }
        }
      }
    }
  }

  return {
    passed: offending.length === 0,
    offendingMaterials: offending,
  };
}
