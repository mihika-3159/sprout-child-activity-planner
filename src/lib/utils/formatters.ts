/**
 * Sprout Display Formatters
 *
 * Ensures system variable names, enum keys, and snake_case values
 * are NEVER displayed directly to parents or administrators.
 */

const MATERIAL_LABELS: Record<string, string> = {
  paper: "Plain Paper",
  pencils_crayons: "Pencils & Crayons",
  cardboard: "Cardboard Boxes & Scraps",
  tape: "Masking or Painter's Tape",
  child_safe_scissors: "Child-Safe Scissors",
  blocks_lego: "Building Blocks or Lego",
  books: "Picture Books or Storybooks",
  household_containers: "Tubs, Cups & Containers",
  recycled_materials: "Clean Recycled Items",
  outdoor_natural: "Leaves, Twigs & Stones",
  craft_supplies: "Craft Paper, Glue & Ribbons",
};

const GOAL_LABELS: Record<string, string> = {
  independent_play: "Independent Play",
  creativity: "Creativity & Art",
  learning: "Curiosity & Early Learning",
  physical_movement: "Movement & Motor Skills",
  quiet_time: "Calm & Quiet Time",
  concentration: "Focus & Attention",
  problem_solving: "Problem Solving & Logic",
  reading_language: "Reading & Vocabulary",
  numeracy: "Counting & Math Concepts",
  fine_motor: "Fine Motor & Dexterity",
  imaginative_play: "Imaginative Pretend Play",
  outdoor_activity: "Fresh Air & Outdoor Exploration",
  winding_down: "Bedtime Winding Down",
};

const SUPERVISION_LABELS: Record<string, string> = {
  fully_independent: "Fully Independent",
  independent: "Independent Play",
  setup_then_independent: "Setup, Then Independent",
  periodic_checkin: "Periodic Check-in",
  occasional_checkin: "Occasional Check-in",
  active_supervision: "Active Supervision Required",
  parent_participation_fine: "Parent Participation Welcome",
};

const ENVIRONMENT_LABELS: Record<string, string> = {
  indoors: "Indoor Living Space",
  outdoors: "Outdoor / Backyard",
  either: "Flexible (Indoors or Outdoors)",
  apartment_small_indoor: "Apartment / Compact Indoor",
  garden_outdoor_available: "Garden / Yard Space",
};

/**
 * Cleanly format any arbitrary system string:
 * removes underscores, hyphens, and title-cases words.
 */
export function humanize(str?: string | null): string {
  if (!str) return "";
  const cleaned = str.replace(/_/g, " ").replace(/-/g, " ").trim();
  return cleaned
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function formatMaterial(key?: string | null): string {
  if (!key) return "";
  return MATERIAL_LABELS[key] || humanize(key);
}

export function formatGoal(key?: string | null): string {
  if (!key) return "";
  return GOAL_LABELS[key] || humanize(key);
}

export function formatSupervision(key?: string | null): string {
  if (!key) return "";
  return SUPERVISION_LABELS[key] || humanize(key);
}

export function formatEnvironment(key?: string | null): string {
  if (!key) return "";
  return ENVIRONMENT_LABELS[key] || humanize(key);
}
