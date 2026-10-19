import type { MonthlyPlanner, PlannedActivity, WeeklyPlanner } from "@/lib/schemas/preferences";

/** Activity cards for the print view, preserving each week and day. */
export interface PrintableCard {
  weekNumber: number;
  theme?: string;
  dayNumber: number;
  activityIndex: number;
  activitiesInDay: number;
  startsWeek: boolean;
  activity: PlannedActivity;
}

export function getPrintableCards(
  planner: WeeklyPlanner | MonthlyPlanner,
  isWeekly: boolean
): PrintableCard[] {
  const weeks = isWeekly
    ? [{ weekNumber: 1, days: (planner as WeeklyPlanner).days }]
    : (planner as MonthlyPlanner).weeks;

  return weeks.flatMap((week) =>
    week.days.flatMap((day, dayIndex) =>
      day.activities.map((activity, activityIndex) => ({
        weekNumber: week.weekNumber,
        theme: "theme" in week ? week.theme : undefined,
        dayNumber: day.dayNumber,
        activityIndex,
        activitiesInDay: day.activities.length,
        startsWeek: !isWeekly && dayIndex === 0 && activityIndex === 0,
        activity,
      }))
    )
  );
}

/** Escape AI- or user-provided strings before embedding them into HTML. */
export function escapePrintableHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      default: return "&#39;";
    }
  });
}
