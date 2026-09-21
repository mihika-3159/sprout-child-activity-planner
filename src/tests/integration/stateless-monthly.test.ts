import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST as generateWeek } from "../../app/api/planner/[generationId]/week/route";
import { normalizePlannerPreferences } from "../../lib/schemas/preferences";
import { signGenerationToken } from "../../lib/session/generationToken";

describe("stateless monthly generation", () => {
  it("generates a complete week without a shared database record", async () => {
    const generationId = `stateless-cold-start-${Date.now()}`;
    const preferences = normalizePlannerPreferences({
      ageBand: "2-3",
      interests: ["animals"],
      goals: ["fine_motor"],
      environment: "indoors",
      duration: "10-15",
      parentInvolvement: "parent_participation_fine",
      productType: "monthly",
    });
    const token = signGenerationToken(generationId);
    const request = new NextRequest(`http://localhost/api/planner/${generationId}/week`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-generation-token": token },
      body: JSON.stringify({ weekNumber: 1, preferences, existingTitles: [], existingMechanics: [] }),
    });

    const response = await generateWeek(request, { params: Promise.resolve({ generationId }) });
    const data = await response.json();
    expect(response.status, JSON.stringify(data)).toBe(200);
    expect(data.week.days).toHaveLength(7);
    for (const day of data.week.days) {
      expect(day.activities[0].targetAgeBand).toBe("2-3");
      expect(day.activities[0].supervisionLevel).toBe("active_supervision");
    }
  }, 30000);

  it("rejects stateless generation when the signed token is missing", async () => {
    const generationId = "stateless-unauthorised-test";
    const request = new NextRequest(`http://localhost/api/planner/${generationId}/week`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ weekNumber: 1, preferences: normalizePlannerPreferences({ ageBand: "4-5" }) }),
    });
    const response = await generateWeek(request, { params: Promise.resolve({ generationId }) });
    expect(response.status).toBe(404);
  });
});
