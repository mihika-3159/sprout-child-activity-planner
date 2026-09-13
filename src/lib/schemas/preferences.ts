/**
 * Structured Preference Schema
 *
 * All parent inputs are validated against this schema before any processing.
 * Structured inputs minimize free text sent to AI providers (privacy principle 27I).
 */
import { z } from "zod";

export const AGE_BANDS = ["2-3", "4-5", "6-7", "8-9", "10-12", "13+"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export const INTERESTS = [
  "animals",
  "dinosaurs",
  "art",
  "building",
  "nature",
  "stories",
  "music",
  "space",
  "sports",
  "pretend_play",
  "science",
  "puzzles",
  "cooking",
  "vehicles",
] as const;
export type Interest = (typeof INTERESTS)[number];

export const GOALS = [
  "independent_play",
  "creativity",
  "learning",
  "physical_movement",
  "quiet_time",
  "concentration",
  "problem_solving",
  "reading_language",
  "numeracy",
  "fine_motor",
  "imaginative_play",
  "outdoor_activity",
  "winding_down",
] as const;
export type Goal = (typeof GOALS)[number];

export const ENVIRONMENTS = [
  "indoors",
  "outdoors",
  "either",
  "apartment_small_indoor",
  "garden_outdoor_available",
] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

export const DURATIONS = [
  "10-15",
  "20-30",
  "30-60",
  "60+",
] as const;
export type Duration = (typeof DURATIONS)[number];

export const PARENT_INVOLVEMENTS = [
  "fully_independent",
  "setup_then_independent",
  "occasional_checkin",
  "parent_participation_fine",
] as const;
export type ParentInvolvement = (typeof PARENT_INVOLVEMENTS)[number];

export const PREP_TOLERANCES = [
  "none",
  "under_5_min",
  "under_15_min",
  "ok_with_prep",
] as const;
export type PrepTolerance = (typeof PREP_TOLERANCES)[number];

export const MATERIALS = [
  "paper",
  "pencils_crayons",
  "cardboard",
  "tape",
  "child_safe_scissors",
  "blocks_lego",
  "books",
  "household_containers",
  "recycled_materials",
  "outdoor_natural",
  "craft_supplies",
] as const;
export type Material = (typeof MATERIALS)[number];

export const ENERGY_LEVELS = ["calm", "moderate", "energetic", "mix"] as const;
export type EnergyLevel = (typeof ENERGY_LEVELS)[number];

export const ACTIVITIES_PER_DAY = [1, 2, 3] as const;
export type ActivitiesPerDay = (typeof ACTIVITIES_PER_DAY)[number];

export const PLANNER_PRODUCTS = ["weekly", "monthly", "yearly"] as const;
export type PlannerProduct = (typeof PLANNER_PRODUCTS)[number];

// ─── Child Profile (NO identifying info) ─────────────────────────────────────

export const ChildProfileSchema = z.object({
  ageBand: z.enum(AGE_BANDS),
  // Number of children — no names
  numberOfChildren: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
  // If multiple children, their age bands (no names)
  additionalChildAgeBands: z.array(z.enum(AGE_BANDS)).max(5).default([]),
});

export type ChildProfile = z.infer<typeof ChildProfileSchema>;

// ─── Planner Preferences ─────────────────────────────────────────────────────

export const PlannerPreferencesSchema = z.object({
  // Child
  child: ChildProfileSchema,

  // What the child enjoys (structured selection, no names)
  interests: z.array(z.enum(INTERESTS)).min(1).max(8),
  customInterests: z
    .array(z.string().max(50).trim())
    .max(3)
    .default([])
    .describe("Non-identifying custom interests"),

  // Parent goals
  goals: z.array(z.enum(GOALS)).min(1).max(5),

  // Environment
  environment: z.enum(ENVIRONMENTS),

  // Time available
  duration: z.enum(DURATIONS),

  // How involved the parent wants to be
  parentInvolvement: z.enum(PARENT_INVOLVEMENTS),

  // Preparation tolerance
  prepTolerance: z.enum(PREP_TOLERANCES),

  // Available materials
  materials: z.array(z.enum(MATERIALS)),
  householdMaterialsOnly: z.boolean().default(false),

  // Activity energy
  energyLevel: z.enum(ENERGY_LEVELS),

  // Planner structure
  activitiesPerDay: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),

  // Which product
  productType: z.enum(PLANNER_PRODUCTS),

  // How many other children can play with the child (0 = solo play)
  playmatesCount: z.number().int().min(0).max(10).optional().default(0),
});

export type PlannerPreferences = z.infer<typeof PlannerPreferencesSchema>;

// ─── Supervision Level ────────────────────────────────────────────────────────

export const SUPERVISION_LEVELS = [
  "independent",
  "setup_then_independent",
  "periodic_checkin",
  "active_supervision",
] as const;
export type SupervisionLevel = (typeof SUPERVISION_LEVELS)[number];

// ─── Planned Activity ─────────────────────────────────────────────────────────

export const PlannedActivitySchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(3).max(80),
  targetAgeBand: z.enum(AGE_BANDS),
  description: z.string().min(20).max(500),
  instructions: z.array(z.string()).min(1).max(10),
  materials: z.array(z.string()).max(12),
  setupMinutes: z.number().int().min(0).max(60),
  activityMinutes: z.object({
    min: z.number().int().min(1),
    max: z.number().int().min(1),
  }),
  supervisionLevel: z.enum(SUPERVISION_LEVELS),
  parentSetup: z.array(z.string()).max(6),
  developmentalDomains: z.array(z.string()).min(1).max(5),
  rationale: z.string().min(20).max(600),
  whyEngaging: z.string().max(600).optional(),
  evidence: z.array(
    z.object({
      sourceIds: z.array(z.string()),
      chunkIds: z.array(z.string()),
      supportExplanation: z.string().max(400),
    })
  ),
  safetyNotes: z.array(z.string()).max(5),
  easyVariation: z.string().max(300),
  extension: z.string().max(300),
  noveltySignature: z.string(),
  // Evidence support object (internal)
  evidenceSupport: z.object({
    evidenceChunkIds: z.array(z.string()),
    supportedDomains: z.array(z.string()),
    evidenceStrength: z.enum(["strong", "moderate", "limited"]).optional(),
    claimsAllowed: z.array(z.string()),
  }),
});

export type PlannedActivity = z.infer<typeof PlannedActivitySchema>;

// ─── Planner Outputs ─────────────────────────────────────────────────────────

export const WeeklyPlannerSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string(),
  preferences: PlannerPreferencesSchema,
  generatedAt: z.string().datetime(),
  days: z.array(
    z.object({
      dayNumber: z.number().int().min(1).max(7),
      activities: z.array(PlannedActivitySchema),
    })
  ).length(7),
  materialsOverview: z.array(z.string()),
  prepWeekIn10Minutes: z.string().max(1000),
  evidenceSummary: z.string().max(600),
});

export type WeeklyPlanner = z.infer<typeof WeeklyPlannerSchema>;

export const MonthlyPlannerSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string(),
  preferences: PlannerPreferencesSchema,
  generatedAt: z.string().datetime(),
  monthlyOverview: z.object({
    activityMix: z.string(),
    materialsToKeepNearby: z.array(z.string()),
    estimatedParentPrepPerWeek: z.string(),
    optionalWeeklyThemes: z.array(z.string()).optional(),
    numberOfLowSupervisionActivities: z.number().int(),
  }),
  prepThisMonth: z.string().max(1000),
  weeks: z.array(
    z.object({
      weekNumber: z.number().int().min(1).max(5),
      theme: z.string().optional(),
      days: z.array(
        z.object({
          dayNumber: z.number().int().min(1).max(7),
          activities: z.array(PlannedActivitySchema),
        })
      ),
    })
  ),
  globalMaterialsPool: z.array(z.string()),
});

export type MonthlyPlanner = z.infer<typeof MonthlyPlannerSchema>;

// ─── Display helpers ──────────────────────────────────────────────────────────

export const INTEREST_LABELS: Record<Interest, string> = {
  animals: "Animals",
  dinosaurs: "Dinosaurs",
  art: "Art & Drawing",
  building: "Building & Construction",
  nature: "Nature & Outdoors",
  stories: "Stories & Books",
  music: "Music",
  space: "Space & Science",
  sports: "Sports & Movement",
  pretend_play: "Pretend Play",
  science: "Science & Experiments",
  puzzles: "Puzzles & Games",
  cooking: "Cooking & Baking",
  vehicles: "Vehicles & Transport",
};

export const GOAL_LABELS: Record<Goal, string> = {
  independent_play: "Independent play",
  creativity: "Creativity",
  learning: "Learning",
  physical_movement: "Physical movement",
  quiet_time: "Quiet time",
  concentration: "Concentration",
  problem_solving: "Problem solving",
  reading_language: "Reading & language",
  numeracy: "Numeracy",
  fine_motor: "Fine motor practice",
  imaginative_play: "Imaginative play",
  outdoor_activity: "Outdoor activity",
  winding_down: "Winding down",
};

export const ENVIRONMENT_LABELS: Record<Environment, string> = {
  indoors: "Indoors",
  outdoors: "Outdoors",
  either: "Either works",
  apartment_small_indoor: "Apartment / small indoor space",
  garden_outdoor_available: "Garden / outdoor space available",
};

export const DURATION_LABELS: Record<Duration, string> = {
  "10-15": "10–15 minutes",
  "20-30": "20–30 minutes",
  "30-60": "30–60 minutes",
  "60+": "1 hour or more",
};

export const INVOLVEMENT_LABELS: Record<ParentInvolvement, string> = {
  fully_independent: "Child can do it almost entirely independently",
  setup_then_independent: "I can help set it up, then they continue alone",
  occasional_checkin: "Occasional check-in is fine",
  parent_participation_fine: "I don't mind joining in",
};

export const PREP_LABELS: Record<PrepTolerance, string> = {
  none: "Almost none — grab and go",
  under_5_min: "Under 5 minutes prep",
  under_15_min: "Under 15 minutes prep",
  ok_with_prep: "Preparation is okay",
};

export const MATERIAL_LABELS: Record<Material, string> = {
  paper: "Paper",
  pencils_crayons: "Pencils / crayons",
  cardboard: "Cardboard",
  tape: "Tape",
  child_safe_scissors: "Child-safe scissors",
  blocks_lego: "Blocks / LEGO-style construction",
  books: "Books",
  household_containers: "Household containers",
  recycled_materials: "Recycled materials",
  outdoor_natural: "Outdoor / natural materials",
  craft_supplies: "Craft supplies",
};

export const ENERGY_LABELS: Record<EnergyLevel, string> = {
  calm: "Calm & quiet",
  moderate: "Moderate energy",
  energetic: "Energetic & active",
  mix: "Mix of energies",
};

export const SUPERVISION_LABELS: Record<SupervisionLevel, string> = {
  independent: "Independent",
  setup_then_independent: "Setup + independent",
  periodic_checkin: "Periodic check-ins",
  active_supervision: "Active supervision",
};
