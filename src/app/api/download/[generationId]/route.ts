import { NextRequest, NextResponse } from "next/server";
import { getOrCreateSession } from "@/lib/session/anonymous";
import { getDb } from "@/lib/db/schema";
import { verifyEntitlement } from "@/lib/entitlement/check";
import { WeeklyPlanner, MonthlyPlanner, PlannedActivity } from "@/lib/schemas/preferences";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ generationId: string }> }
) {
  try {
    const { sessionId } = await getOrCreateSession();
    const { generationId } = await params;

    // Strict server-side entitlement check
    const entitlement = verifyEntitlement(sessionId, generationId);
    if (!entitlement) {
      return new NextResponse(
        `<html><body style="font-family: sans-serif; padding: 2rem; text-align: center;"><h2>Access Denied</h2><p>A valid purchase entitlement is required to download this planner.</p></body></html>`,
        { status: 403, headers: { "Content-Type": "text/html" } }
      );
    }

    const db = getDb();
    const generation = db
      .prepare("SELECT full_data, product_type FROM planner_generations WHERE id = ? AND session_id = ?")
      .get(generationId, sessionId) as { full_data: string | null; product_type: string } | undefined;

    if (!generation || !generation.full_data) {
      return new NextResponse("Planner data not found", { status: 404 });
    }

    const isWeekly = generation.product_type === "weekly";
    const planner = JSON.parse(generation.full_data) as WeeklyPlanner | MonthlyPlanner;

    const days: Array<{ dayNumber: number; activities: PlannedActivity[] }> = isWeekly
      ? (planner as WeeklyPlanner).days
      : (planner as MonthlyPlanner).weeks[0].days;

    const materials = isWeekly
      ? (planner as WeeklyPlanner).materialsOverview
      : (planner as MonthlyPlanner).globalMaterialsPool;

    const prepSummary = isWeekly
      ? (planner as WeeklyPlanner).prepWeekIn10Minutes
      : (planner as MonthlyPlanner).prepThisMonth;

    // Generate clean, high-contrast, ink-saving printable HTML view
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Sprout Activity Planner - Age ${planner.preferences.child.ageBand}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 1.5cm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1a1a1a;
      line-height: 1.5;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }
    .header {
      border-bottom: 2px solid #2e4a2a;
      padding-bottom: 1rem;
      margin-bottom: 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .brand {
      font-size: 1.5rem;
      font-weight: 800;
      color: #2e4a2a;
    }
    .title {
      font-size: 1.25rem;
      font-weight: 700;
      margin: 0.25rem 0 0;
    }
    .meta {
      font-size: 0.85rem;
      color: #555;
    }
    .prep-box {
      border: 1.5px solid #666;
      border-radius: 6px;
      padding: 1rem;
      margin-bottom: 1.5rem;
      background: #fafafa;
    }
    .prep-title {
      font-weight: 700;
      font-size: 0.95rem;
      margin-bottom: 0.25rem;
    }
    .materials-tag {
      display: inline-block;
      border: 1px solid #999;
      border-radius: 12px;
      padding: 2px 8px;
      font-size: 0.75rem;
      margin: 2px;
    }
    .day-card {
      border: 1px solid #ccc;
      border-radius: 6px;
      padding: 1rem;
      margin-bottom: 1.25rem;
      page-break-inside: avoid;
    }
    .day-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
      border-bottom: 1px solid #eee;
      padding-bottom: 0.25rem;
    }
    .day-title {
      font-weight: 700;
      font-size: 1.05rem;
    }
    .checkbox-box {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 1.5px solid #333;
      border-radius: 3px;
      margin-right: 6px;
      vertical-align: middle;
    }
    .steps {
      padding-left: 1.2rem;
      font-size: 0.85rem;
      margin: 0.5rem 0;
    }
    .steps li {
      margin-bottom: 0.25rem;
    }
    .rationale {
      font-size: 0.8rem;
      color: #444;
      font-style: italic;
      margin-top: 0.5rem;
      border-top: 1px dashed #ddd;
      padding-top: 0.25rem;
    }
    .no-print {
      margin-bottom: 1.5rem;
      background: #f0f4ef;
      padding: 1rem;
      border-radius: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    @media print {
      .no-print {
        display: none !important;
      }
      body {
        font-size: 10pt;
      }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <span>🌱 <strong>Sprout Planner Printable View</strong> (A4 & US Letter friendly)</span>
    <button onclick="window.print()" style="background: #2e4a2a; color: white; border: none; padding: 6px 16px; border-radius: 20px; font-weight: 600; cursor: pointer;">
      Print / Save PDF
    </button>
  </div>

  <div class="header">
    <div>
      <div class="brand">🌱 Sprout Activity Planner</div>
      <div class="title">Personalised Screen-Free Activity Plan</div>
    </div>
    <div class="meta" style="text-align: right;">
      <div>Age Band: <strong>${planner.preferences.child.ageBand}</strong></div>
      <div>Environment: ${planner.preferences.environment}</div>
    </div>
  </div>

  <div class="prep-box">
    <div class="prep-title">⏱️ Prepare the Week in 10 Minutes</div>
    <p style="font-size: 0.85rem; margin: 0.25rem 0 0.5rem;">${prepSummary}</p>
    <div>
      ${materials.map((m) => `<span class="materials-tag">${m}</span>`).join("")}
    </div>
  </div>

  ${days
    .map(
      (d) => `
    <div class="day-card">
      <div class="day-header">
        <div class="day-title">
          <span class="checkbox-box"></span>
          Day ${d.dayNumber}: ${d.activities[0].title}
        </div>
        <div style="font-size: 0.75rem; color: #666;">
          Setup: ~${d.activities[0].setupMinutes}m | Act: ${d.activities[0].activityMinutes.min}-${d.activities[0].activityMinutes.max}m | ${d.activities[0].supervisionLevel.replace(/_/g, " ")}
        </div>
      </div>
      <p style="font-size: 0.88rem; margin: 0.25rem 0 0.5rem;">${d.activities[0].description}</p>
      
      <div style="font-size: 0.8rem; font-weight: 600;">Child Instructions:</div>
      <ol class="steps">
        ${d.activities[0].instructions.map((step) => `<li>${step}</li>`).join("")}
      </ol>

      <div style="font-size: 0.78rem; color: #555;">
        <strong>Materials:</strong> ${d.activities[0].materials.join(", ")}
      </div>

      <div class="rationale">
        Why it's here: ${d.activities[0].rationale}
      </div>
    </div>
  `
    )
    .join("")}

  <div style="font-size: 0.75rem; color: #777; text-align: center; margin-top: 2rem; border-top: 1px solid #eee; padding-top: 0.5rem;">
    Sprout Planner · Evidence-Grounded Screen-Free Activities · Not Medical Advice
  </div>
</body>
</html>`;

    db.prepare("INSERT INTO analytics_events (event_type, product_type) VALUES ('planner_downloaded', ?)").run(
      generation.product_type
    );

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (err: unknown) {
    console.error("[Download Route Error]:", err);
    return new NextResponse("Error generating printable plan", { status: 500 });
  }
}
