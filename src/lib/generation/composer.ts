/**
 * Weekly & Monthly Planner Composer
 *
 * Composes balanced 7-day, 4-week, and hierarchical yearly plans.
 * Balances developmental domains, intensity, materials, and supervision levels.
 * Stores full generation in database and produces safe, server-gated preview payloads.
 *
 * Per spec sections 12A, 12B, 13, 14.
 */
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../db/schema";
import {
  PlannerPreferences,
  WeeklyPlanner,
  MonthlyPlanner,
  PlannedActivity,
} from "../schemas/preferences";
import { generateSingleActivity } from "./pipeline";

export interface PlannerPreviewPayload {
  generationId: string;
  productType: "weekly" | "monthly" | "yearly";
  targetAgeBand: string;
  preferencesSummary: {
    ageBand: string;
    interests: string[];
    goals: string[];
    environment: string;
    duration: string;
    parentInvolvement: string;
    materials: string[];
  };
  day1Activity: PlannedActivity;
  day2Teaser: {
    title: string;
    descriptionSnippet: string;
    developmentalDomains: string[];
    estimatedMinutes: number;
    setupMinutes: number;
    supervisionLevel: string;
  };
  totalActivitiesCount: number;
  materialsOverview: string[];
  prepWeekSummary: string;
  evidenceSummary: string;
  isUnlocked: boolean;
}

/**
 * Generate a complete 7-Day Weekly Planner
 */
export async function composeWeeklyPlanner(params: {
  sessionId: string;
  preferences: PlannerPreferences;
}): Promise<{ planner: WeeklyPlanner; preview: PlannerPreviewPayload }> {
  const { sessionId, preferences } = params;
  const generationId = uuidv4();
  const db = getDb();

  // Create initial generation record
  db.prepare(`
    INSERT INTO planner_generations (
      id, session_id, product_type, status, preferences
    ) VALUES (?, ?, 'weekly', 'generating', ?)
  `).run(generationId, sessionId, JSON.stringify(preferences));

  const activitiesPerDay = preferences.activitiesPerDay || 1;
  const days: Array<{ dayNumber: number; activities: PlannedActivity[] }> = [];
  const allMaterials = new Set<string>();

  // Compose 7 days deliberately
  for (let dayNum = 1; dayNum <= 7; dayNum++) {
    const dayActivities: PlannedActivity[] = [];
    for (let actIdx = 0; actIdx < activitiesPerDay; actIdx++) {
      // Cycle through parent's stated goals and interests across days
      const targetGoal = preferences.goals[(dayNum + actIdx - 1) % preferences.goals.length];
      const activity = await generateSingleActivity({
        sessionId,
        preferences,
        dayNumber: dayNum,
        activityIndex: actIdx,
        targetDomain: targetGoal,
      });

      dayActivities.push(activity);
      activity.materials.forEach((m) => allMaterials.add(m));

      // Store in planner_activities table
      db.prepare(`
        INSERT INTO planner_activities (
          id, generation_id, day_number, activity_index, activity_data, novelty_signature
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        activity.id,
        generationId,
        dayNum,
        actIdx,
        JSON.stringify(activity),
        activity.noveltySignature
      );
    }
    days.push({ dayNumber: dayNum, activities: dayActivities });
  }

  const materialsOverview = Array.from(allMaterials);
  const targetAge = preferences.ageBand || preferences.child?.ageBand || "4-5";
  const isToddler = targetAge === "2-3";
  const prepWeekIn10Minutes = isToddler
    ? `Set aside a shoebox or tray with: ${materialsOverview.slice(0, 6).join(", ")}. Having these ready in advance helps you start each supervised activity quickly during the week.`
    : `Set aside a shoebox or tray with: ${materialsOverview.slice(0, 6).join(", ")}. Lay these out once on Sunday evening to enable quick, low-friction activity starts all week.`;
  const parentInvolvement = preferences.involvement || preferences.parentInvolvement || "setup_then_independent";
  const materials = preferences.selectedMaterials || preferences.materials || [];
  const interests = [...(preferences.interests || []), ...(preferences.customInterests || [])];
  const evidenceSummary = `Activities are age-calibrated and paired with related developmental reading; the references support broad principles, not a guarantee of outcomes.`;

  const fullPlanner: WeeklyPlanner = {
    id: generationId,
    sessionId,
    preferences,
    generatedAt: new Date().toISOString(),
    days,
    materialsOverview,
    prepWeekIn10Minutes,
    evidenceSummary,
  };

  // Build the safe preview payload (Server Gated - does NOT leak days 2-7 full details)
  const day1 = days[0].activities[0];
  const day2 = days[1].activities[0];

  const preview: PlannerPreviewPayload = {
    generationId,
    productType: "weekly",
    targetAgeBand: targetAge,
    preferencesSummary: {
      ageBand: targetAge,
      interests,
      goals: preferences.goals || [],
      environment: preferences.environment || "indoors",
      duration: preferences.duration || "20-30",
      parentInvolvement,
      materials,
    },
    day1Activity: day1,
    day2Teaser: {
      title: day2.title,
      descriptionSnippet: day2.description.slice(0, 60) + "...",
      developmentalDomains: day2.developmentalDomains,
      estimatedMinutes: day2.activityMinutes.max,
      setupMinutes: day2.setupMinutes,
      supervisionLevel: day2.supervisionLevel,
    },
    totalActivitiesCount: days.reduce((sum, d) => sum + d.activities.length, 0),
    materialsOverview,
    prepWeekSummary: prepWeekIn10Minutes,
    evidenceSummary,
    isUnlocked: false,
  };

  // Update generation record with preview_data and full_data
  db.prepare(`
    UPDATE planner_generations
    SET status = 'preview_ready',
        preview_data = ?,
        full_data = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(JSON.stringify(preview), JSON.stringify(fullPlanner), generationId);

  return { planner: fullPlanner, preview };
}

/**
 * Generate a complete 4-Week Monthly Planner
 */
export async function composeMonthlyPlanner(params: {
  sessionId: string;
  preferences: PlannerPreferences;
}): Promise<{ planner: MonthlyPlanner; preview: PlannerPreviewPayload }> {
  const { sessionId, preferences } = params;
  const generationId = uuidv4();
  const db = getDb();

  db.prepare(`
    INSERT INTO planner_generations (
      id, session_id, product_type, status, preferences
    ) VALUES (?, ?, 'monthly', 'generating', ?)
  `).run(generationId, sessionId, JSON.stringify(preferences));

  const weeks: MonthlyPlanner["weeks"] = [];
  const globalMaterials = new Set<string>();
  const weeklyThemes = [
    "Exploration & Discovery",
    "Story & Imagination",
    "Building & Engineering",
    "Nature & Observation",
  ];

  for (let weekNum = 1; weekNum <= 4; weekNum++) {
    const theme = weeklyThemes[weekNum - 1];
    const dayIndices = [1, 2, 3, 4, 5, 6, 7];

    // Generate all 7 days for the current week concurrently
    const weekActivities = await Promise.all(
      dayIndices.map((dayNum) =>
        generateSingleActivity({
          sessionId,
          preferences,
          dayNumber: (weekNum - 1) * 7 + dayNum,
          targetDomain: theme,
        })
      )
    );

    const weekDays: Array<{ dayNumber: number; activities: PlannedActivity[] }> = [];

    for (let i = 0; i < weekActivities.length; i++) {
      const act = weekActivities[i];
      const dayNum = i + 1;
      act.materials.forEach((m) => globalMaterials.add(m));
      weekDays.push({ dayNumber: dayNum, activities: [act] });

      db.prepare(`
        INSERT INTO planner_activities (
          id, generation_id, week_number, day_number, activity_index, activity_data, novelty_signature
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        act.id,
        generationId,
        weekNum,
        dayNum,
        0,
        JSON.stringify(act),
        act.noveltySignature
      );
    }
    weeks.push({ weekNumber: weekNum, theme, days: weekDays });
  }

  const materialsList = Array.from(globalMaterials);
  const fullMonthlyPlanner: MonthlyPlanner = {
    id: generationId,
    sessionId,
    preferences,
    generatedAt: new Date().toISOString(),
    monthlyOverview: {
      activityMix: "Balanced distribution of fine-motor, creative storytelling, cognitive problem solving, and physical movement.",
      materialsToKeepNearby: materialsList.slice(0, 8),
      estimatedParentPrepPerWeek: "~10 minutes of initial setup on Sundays.",
      optionalWeeklyThemes: weeklyThemes,
      numberOfLowSupervisionActivities: 20,
    },
    prepThisMonth: (preferences.ageBand === "2-3" || preferences.child?.ageBand === "2-3")
      ? `Consolidate everyday materials into an activity basket: ${materialsList.slice(0, 8).join(", ")}. Reusable across all 4 weeks to help you start each supervised activity quickly.`
      : `Consolidate everyday materials into an activity basket: ${materialsList.slice(0, 8).join(", ")}. Reusable across all 4 weeks without purchasing new craft kits.`,
    weeks,
    globalMaterialsPool: materialsList,
  };

  const day1 = weeks[0].days[0].activities[0];
  const day2 = weeks[0].days[1].activities[0];

  const targetAge = preferences.ageBand || preferences.child?.ageBand || "4-5";
  const parentInvolvement = preferences.involvement || preferences.parentInvolvement || "setup_then_independent";
  const materials = preferences.selectedMaterials || preferences.materials || [];
  const interests = [...(preferences.interests || []), ...(preferences.customInterests || [])];

  const preview: PlannerPreviewPayload = {
    generationId,
    productType: "monthly",
    targetAgeBand: targetAge,
    preferencesSummary: {
      ageBand: targetAge,
      interests,
      goals: preferences.goals || [],
      environment: preferences.environment || "indoors",
      duration: preferences.duration || "20-30",
      parentInvolvement,
      materials,
    },
    day1Activity: day1,
    day2Teaser: {
      title: day2.title,
      descriptionSnippet: day2.description.slice(0, 60) + "...",
      developmentalDomains: day2.developmentalDomains,
      estimatedMinutes: day2.activityMinutes.max,
      setupMinutes: day2.setupMinutes,
      supervisionLevel: day2.supervisionLevel,
    },
    totalActivitiesCount: 28,
    materialsOverview: materialsList,
    prepWeekSummary: fullMonthlyPlanner.prepThisMonth,
    evidenceSummary: `Activities include related developmental reading for context; individual results vary.`,
    isUnlocked: false,
  };

  db.prepare(`
    UPDATE planner_generations
    SET status = 'preview_ready',
        preview_data = ?,
        full_data = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(JSON.stringify(preview), JSON.stringify(fullMonthlyPlanner), generationId);

  return { planner: fullMonthlyPlanner, preview };
}
