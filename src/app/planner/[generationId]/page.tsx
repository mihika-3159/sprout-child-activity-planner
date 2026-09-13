"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { WeeklyPlanner, MonthlyPlanner, PlannedActivity } from "@/lib/schemas/preferences";
import FeedbackWidget from "@/components/FeedbackWidget";
import ActivityChatDrawer from "@/components/ActivityChatDrawer";
import { formatMaterial, formatSupervision, formatGoal, humanize } from "@/lib/utils/formatters";

export default function FullPlannerPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const generationId = params.generationId as string;
  const isJustUnlocked = searchParams.get("unlocked") === "true";

  const [planner, setPlanner] = useState<WeeklyPlanner | MonthlyPlanner | null>(null);
  const [productType, setProductType] = useState<string>("weekly");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeEvidenceDrawer, setActiveEvidenceDrawer] = useState<string | null>(null);
  const [regeneratingActivityId, setRegeneratingActivityId] = useState<string | null>(null);
  const [chatActivity, setChatActivity] = useState<PlannedActivity | null>(null);

  useEffect(() => {
    async function loadFullPlanner() {
      try {
        const res = await fetch(`/api/planner/${generationId}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to load planner");
        }

        if (!data.isUnlocked) {
          // If not unlocked, redirect back to preview
          router.replace(`/preview/${generationId}`);
          return;
        }

        setPlanner(data.planner);
        setProductType(data.productType);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load planner");
      } finally {
        setLoading(false);
      }
    }
    if (generationId) {
      loadFullPlanner();
    }
  }, [generationId, router]);

  // Handle single activity regeneration
  const handleRegenerateActivity = async (dayNumber: number, activityIndex = 0, weekNumber = 1) => {
    setRegeneratingActivityId(`day-${dayNumber}-${activityIndex}`);
    try {
      const res = await fetch(`/api/planner/${generationId}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayNumber, activityIndex, weekNumber }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Regeneration failed");
      }

      // Update state locally
      if (planner && "days" in planner) {
        const updated = { ...planner } as WeeklyPlanner;
        const day = updated.days.find((d) => d.dayNumber === dayNumber);
        if (day) {
          day.activities[activityIndex] = data.activity;
          setPlanner(updated);
        }
      } else if (planner && "weeks" in planner) {
        const updated = { ...planner } as MonthlyPlanner;
        const week = updated.weeks.find((w) => w.weekNumber === weekNumber);
        const day = week?.days.find((d) => d.dayNumber === dayNumber);
        if (day) {
          day.activities[activityIndex] = data.activity;
          setPlanner(updated);
        }
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to regenerate activity");
    } finally {
      setRegeneratingActivityId(null);
    }
  };

  const handleClearSession = async () => {
    if (!confirm("This will permanently clear all your saved activity plans and preferences. Continue?")) {
      return;
    }
    await fetch("/api/session/clear", { method: "POST" });
    router.push("/");
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-cream)" }}>
        <p className="animate-pulse" style={{ fontSize: "1.25rem", color: "var(--color-sage-700)" }}>
          🌱 Loading your complete activity plan...
        </p>
      </div>
    );
  }

  if (error || !planner) {
    return (
      <div style={{ minHeight: "100vh", padding: "3rem 1.5rem", background: "var(--color-cream)" }}>
        <div className="container" style={{ maxWidth: "600px", textAlign: "center" }}>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", color: "var(--color-error)", marginBottom: "1rem" }}>
            Access Restricted
          </h2>
          <p style={{ color: "var(--color-stone-600)", marginBottom: "1.5rem" }}>
            {error || "Entitlement required to view this plan."}
          </p>
          <Link href={`/preview/${generationId}`} className="btn btn-primary">
            Back to Preview
          </Link>
        </div>
      </div>
    );
  }

  const isWeekly = "days" in planner;
  const daysList = isWeekly ? (planner as WeeklyPlanner).days : (planner as MonthlyPlanner).weeks[0].days;

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-cream)", paddingBottom: "5rem" }}>
      {/* Header */}
      <header
        style={{
          borderBottom: "1px solid var(--color-stone-200)",
          background: "white",
          padding: "1rem 0",
          position: "sticky",
          top: 0,
          zIndex: 30,
        }}
      >
        <div className="container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link
            href="/"
            style={{
              fontFamily: "'Outfit', sans-serif",
              fontWeight: 800,
              fontSize: "1.25rem",
              color: "var(--color-sage-600)",
              textDecoration: "none",
            }}
          >
            🌱 Sprout Planner
          </Link>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <a
              href={`/api/download/${generationId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
              id="btn-download-pdf"
            >
              🖨️ Printable PDF / View
            </a>
            <button
              onClick={handleClearSession}
              className="btn btn-ghost btn-sm"
              style={{ color: "var(--color-stone-500)" }}
              id="btn-clear-my-info"
            >
              Clear my information
            </button>
          </div>
        </div>
      </header>

      <main className="container" style={{ maxWidth: "860px", paddingTop: "2.5rem" }}>
        {/* Success Banner if freshly unlocked */}
        {isJustUnlocked && (
          <div
            style={{
              background: "var(--color-success-bg)",
              border: "1px solid var(--color-success)",
              borderRadius: "var(--radius-md)",
              padding: "1rem 1.25rem",
              marginBottom: "2rem",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            <span style={{ fontSize: "1.5rem" }}>🎉</span>
            <div>
              <p style={{ fontWeight: 700, color: "var(--color-success)" }}>Plan Unlocked Successfully!</p>
              <p style={{ fontSize: "0.875rem", color: "var(--color-stone-700)" }}>
                Your complete plan is ready. You can print, download, or regenerate individual activities anytime.
              </p>
            </div>
          </div>
        )}

        {/* Title */}
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "var(--color-sage-100)", color: "var(--color-sage-700)", padding: "0.25rem 0.75rem", borderRadius: "var(--radius-full)", fontSize: "0.75rem", fontWeight: 600, fontFamily: "'Outfit', sans-serif", marginBottom: "0.75rem" }}>
            <span>FULL PLAN</span> · Age {planner.preferences.child.ageBand}
          </div>
          <h1 style={{ fontSize: "clamp(2rem, 4vw, 2.75rem)", marginBottom: "0.5rem" }}>
            Your Personalized Activity Plan
          </h1>
          <p style={{ color: "var(--color-stone-500)", fontSize: "1.0625rem" }}>
            7 days of balanced, screen-free, evidence-grounded activities.
          </p>
        </div>

        {/* 10-Minute Sunday Prep Box */}
        <div
          className="card"
          style={{
            padding: "1.5rem",
            background: "var(--color-amber-50)",
            border: "1.5px solid var(--color-amber-200)",
            marginBottom: "2.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "1.25rem" }}>⏱️</span>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.125rem", color: "var(--color-stone-900)" }}>
              Prepare the Week in 10 Minutes
            </h2>
          </div>
          <p style={{ fontSize: "0.9375rem", color: "var(--color-stone-700)", lineHeight: 1.6, marginBottom: "1rem" }}>
            {(isWeekly ? (planner as WeeklyPlanner).prepWeekIn10Minutes : (planner as MonthlyPlanner).prepThisMonth)
              .replace(/pencils_crayons/g, "pencils & crayons")
              .replace(/child_safe_scissors/g, "child-safe scissors")
              .replace(/_/g, " ")}
          </p>
          <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
            {(isWeekly ? (planner as WeeklyPlanner).materialsOverview : (planner as MonthlyPlanner).globalMaterialsPool).map((m) => (
              <span
                key={m}
                style={{
                  background: "white",
                  border: "1px solid var(--color-amber-300)",
                  borderRadius: "var(--radius-full)",
                  padding: "0.25rem 0.625rem",
                  fontSize: "0.75rem",
                  fontWeight: 500,
                  color: "var(--color-stone-700)",
                }}
              >
                {formatMaterial(m)}
              </span>
            ))}
          </div>
        </div>

        {/* Days Grid */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {daysList.map((day) => {
            const act = day.activities[0];
            const isRegenerating = regeneratingActivityId === `day-${day.dayNumber}-0`;

            return (
              <article
                key={day.dayNumber}
                className="card card-elevated"
                style={{ padding: "2rem", position: "relative" }}
                id={`activity-day-${day.dayNumber}`}
              >
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1rem" }}>
                  <div>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, fontFamily: "'Outfit', sans-serif", color: "var(--color-sage-600)", letterSpacing: "0.05em" }}>
                      DAY {day.dayNumber}
                    </span>
                    <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.375rem", marginTop: "0.25rem" }}>
                      {act.title.replace(/_/g, " ")}
                    </h3>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => setChatActivity(act)}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: "0.8125rem" }}
                      id={`btn-chat-day-${day.dayNumber}`}
                      title="Ask questions, get low-mess adaptations, or advice for reluctant children"
                    >
                      💬 Ask Sprout Coach
                    </button>
                    <button
                      type="button"
                      disabled={isRegenerating}
                      onClick={() => handleRegenerateActivity(day.dayNumber, 0)}
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: "0.8125rem", border: "1px solid var(--color-stone-200)" }}
                      title="Regenerate this activity with a fresh concept"
                    >
                      {isRegenerating ? "Regenerating..." : "🔄 Regenerate"}
                    </button>
                    <span className="evidence-badge evidence-badge-strong">Vetted</span>
                  </div>
                </div>

                <p style={{ color: "var(--color-stone-700)", lineHeight: 1.6, fontSize: "0.9375rem", marginBottom: "1.25rem" }}>
                  {act.description.replace(/_/g, " ")}
                </p>

                {/* Why Kids Love This Box */}
                {act.whyEngaging && (
                  <div
                    style={{
                      background: "var(--color-cream)",
                      borderLeft: "3.5px solid var(--color-sage-600)",
                      padding: "0.875rem 1rem",
                      borderRadius: "var(--radius-sm)",
                      marginBottom: "1.25rem",
                    }}
                  >
                    <p style={{ fontSize: "0.75rem", fontWeight: 700, fontFamily: "'Outfit', sans-serif", color: "var(--color-sage-800)", marginBottom: "0.25rem" }}>
                      ✨ Why Kids Love This:
                    </p>
                    <p style={{ fontSize: "0.875rem", color: "var(--color-stone-700)", lineHeight: 1.55 }}>
                      {act.whyEngaging.replace(/_/g, " ")}
                    </p>
                  </div>
                )}

                {/* Evidence Rationale Box */}
                <div
                  style={{
                    background: "var(--color-sage-50)",
                    border: "1px solid var(--color-sage-200)",
                    borderRadius: "var(--radius-md)",
                    padding: "0.875rem 1rem",
                    marginBottom: "1.25rem",
                  }}
                >
                  <p style={{ fontSize: "0.75rem", fontWeight: 700, fontFamily: "'Outfit', sans-serif", color: "var(--color-sage-700)", marginBottom: "0.25rem" }}>
                    Developmental Focus:
                  </p>
                  <p style={{ fontSize: "0.875rem", color: "var(--color-stone-600)", lineHeight: 1.55 }}>
                    {act.rationale.replace(/_/g, " ")}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveEvidenceDrawer(activeEvidenceDrawer === act.id ? null : act.id)}
                    style={{
                      marginTop: "0.375rem",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "var(--color-sage-600)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    {activeEvidenceDrawer === act.id ? "Hide evidence study ↑" : "Why was this recommended? (Study details) ↓"}
                  </button>

                  {activeEvidenceDrawer === act.id && (
                    <div style={{ marginTop: "0.5rem", paddingTop: "0.5rem", borderTop: "1px dashed var(--color-sage-300)", fontSize: "0.75rem", color: "var(--color-stone-600)" }}>
                      <p style={{ fontWeight: 600, color: "var(--color-stone-800)" }}>Scientific Source Citation:</p>
                      <p>{(act.evidence?.[0]?.supportExplanation || "Grounded in CDC & AAP evidence surveillance guidelines.").replace(/_/g, " ")}</p>
                    </div>
                  )}
                </div>

                {/* Materials list */}
                <div style={{ marginBottom: "1.25rem" }}>
                  <p style={{ fontSize: "0.75rem", fontWeight: 700, fontFamily: "'Outfit', sans-serif", color: "var(--color-stone-500)", marginBottom: "0.35rem" }}>
                    MATERIALS:
                  </p>
                  <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                    {act.materials.map((mat) => (
                      <span
                        key={mat}
                        style={{
                          background: "white",
                          border: "1px solid var(--color-stone-200)",
                          borderRadius: "var(--radius-full)",
                          padding: "0.2rem 0.6rem",
                          fontSize: "0.75rem",
                          color: "var(--color-stone-700)",
                        }}
                      >
                        {formatMaterial(mat)}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Metrics */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem", marginBottom: "1.25rem" }}>
                  <div style={{ background: "var(--color-cream)", borderRadius: "var(--radius-sm)", padding: "0.5rem", textAlign: "center" }}>
                    <p style={{ fontSize: "0.6875rem", color: "var(--color-stone-400)" }}>Setup</p>
                    <p style={{ fontWeight: 700, fontSize: "0.875rem", fontFamily: "'Outfit', sans-serif" }}>~{act.setupMinutes}m</p>
                  </div>
                  <div style={{ background: "var(--color-cream)", borderRadius: "var(--radius-sm)", padding: "0.5rem", textAlign: "center" }}>
                    <p style={{ fontSize: "0.6875rem", color: "var(--color-stone-400)" }}>Activity</p>
                    <p style={{ fontWeight: 700, fontSize: "0.875rem", fontFamily: "'Outfit', sans-serif" }}>{act.activityMinutes.min}–{act.activityMinutes.max}m</p>
                  </div>
                  <div style={{ background: "var(--color-cream)", borderRadius: "var(--radius-sm)", padding: "0.5rem", textAlign: "center" }}>
                    <p style={{ fontSize: "0.6875rem", color: "var(--color-stone-400)" }}>Supervision</p>
                    <p style={{ fontWeight: 700, fontSize: "0.875rem", fontFamily: "'Outfit', sans-serif" }}>
                      {formatSupervision(act.supervisionLevel)}
                    </p>
                  </div>
                </div>

                {/* Instructions */}
                <div style={{ marginBottom: "1.25rem" }}>
                  <p style={{ fontSize: "0.875rem", fontWeight: 700, fontFamily: "'Outfit', sans-serif", marginBottom: "0.375rem" }}>
                    Child Steps:
                  </p>
                  <ol style={{ paddingLeft: "1.25rem", color: "var(--color-stone-700)", lineHeight: 1.55, fontSize: "0.875rem" }}>
                    {act.instructions.map((step, idx) => (
                      <li key={idx} style={{ marginBottom: "0.25rem" }}>{step.replace(/_/g, " ")}</li>
                    ))}
                  </ol>
                </div>

                {/* Easy Variation & Extension */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", fontSize: "0.8125rem" }}>
                  {act.easyVariation && (
                    <div style={{ background: "white", border: "1px solid var(--color-stone-200)", borderRadius: "var(--radius-sm)", padding: "0.75rem" }}>
                      <p style={{ fontWeight: 700, color: "var(--color-stone-700)" }}>Easy Variation:</p>
                      <p style={{ color: "var(--color-stone-500)" }}>{act.easyVariation.replace(/_/g, " ")}</p>
                    </div>
                  )}
                  {act.extension && (
                    <div style={{ background: "white", border: "1px solid var(--color-stone-200)", borderRadius: "var(--radius-sm)", padding: "0.75rem" }}>
                      <p style={{ fontWeight: 700, color: "var(--color-stone-700)" }}>Extension:</p>
                      <p style={{ color: "var(--color-stone-500)" }}>{act.extension.replace(/_/g, " ")}</p>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {/* Community Beta / Demo Feedback Widget */}
        <FeedbackWidget generationId={generationId} />

        {/* Activity Chat Drawer */}
        {chatActivity && (
          <ActivityChatDrawer
            activity={chatActivity}
            childAge={planner.preferences.child.ageBand}
            isOpen={!!chatActivity}
            onClose={() => setChatActivity(null)}
          />
        )}
      </main>
    </div>
  );
}
