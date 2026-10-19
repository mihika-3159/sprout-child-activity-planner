import { describe, expect, it } from "vitest";
import type { MonthlyPlanner, WeeklyPlanner } from "@/lib/schemas/preferences";
import { escapePrintableHtml, getPrintableCards } from "@/lib/utils/printable";

describe("printable planner exports", () => {
  const activity = { title: "Safe activity" };

  it("preserves all 28 days and multiple activities of a monthly plan", () => {
    const planner = {
      weeks: Array.from({ length: 4 }, (_, index) => ({
        weekNumber: index + 1,
        theme: `Theme ${index + 1}`,
        days: Array.from({ length: 7 }, (_, day) => ({
          dayNumber: day + 1,
          activities: [activity, { title: "Second activity" }],
        })),
      })),
    } as unknown as MonthlyPlanner;
    const cards = getPrintableCards(planner, false);
    expect(cards).toHaveLength(56);
    expect(cards.filter((card) => card.startsWeek).map((card) => card.weekNumber)).toEqual([1, 2, 3, 4]);
    expect(cards.filter((card) => card.activityIndex === 0)).toHaveLength(28);
    expect(cards[0]).toMatchObject({ weekNumber: 1, dayNumber: 1, activityIndex: 0, activitiesInDay: 2 });
    expect(cards[cards.length - 1]).toMatchObject({ weekNumber: 4, dayNumber: 7, activityIndex: 1, activitiesInDay: 2 });
  });

  it("keeps weekly exports at seven days without week headings", () => {
    const planner = {
      days: Array.from({ length: 7 }, (_, index) => ({
        dayNumber: index + 1,
        activities: [activity],
      })),
    } as unknown as WeeklyPlanner;
    const cards = getPrintableCards(planner, true);
    expect(cards).toHaveLength(7);
    expect(cards.every((card) => !card.startsWeek)).toBe(true);
  });

  it("escapes unsafe markup and quotes in free-text output", () => {
    expect(escapePrintableHtml(`<img src="x" onerror='alert(1)'>&`))
      .toBe("&lt;img src=&quot;x&quot; onerror=&#39;alert(1)&#39;&gt;&amp;");
    expect(escapePrintableHtml(null)).toBe("");
  });
});
