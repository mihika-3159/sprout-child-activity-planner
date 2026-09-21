"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { WeeklyPlanner, MonthlyPlanner, PlannedActivity } from "@/lib/schemas/preferences";
import FeedbackWidget from "@/components/FeedbackWidget";
import ActivityChatDrawer from "@/components/ActivityChatDrawer";
import { formatMaterial, formatSupervision, formatGoal, humanize } from "@/lib/utils/formatters";
import { clearSproutStorage, loadPlanner, savePlanner } from "@/lib/planner/clientStorage";

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
        const locallyStored = loadPlanner(generationId);
        if (locallyStored) {
          if (locallyStored.generationToken) sessionStorage.setItem(`sprout_token_${generationId}`, locallyStored.generationToken);
          setPlanner(locallyStored.planner);
          setProductType(locallyStored.productType);
          setLoading(false);
          return;
        }
        const tokenFromStorage = typeof window !== "undefined" ? sessionStorage.getItem(`sprout_token_${generationId}`) : null;
        const searchToken = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("token") : null;
        const effectiveToken = searchToken || tokenFromStorage;

        const res = await fetch(`/api/planner/${generationId}${effectiveToken ? `?token=${encodeURIComponent(effectiveToken)}` : ""}`, {
          headers: effectiveToken ? { "X-Generation-Token": effectiveToken } : {},
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to load planner");
        }

        if (!data.isUnlocked) {
          // If not unlocked, redirect back to preview
          router.replace(`/preview/${generationId}${effectiveToken ? `?token=${encodeURIComponent(effectiveToken)}` : ""}`);
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
  const handleRegenerateActivity = async (
    dayNumber: number,
    activityIndex = 0,
    weekNumber = 1,
    currentTitle?: string,
    currentMechanic?: string
  ) => {
    setRegeneratingActivityId(`week-${weekNumber}-day-${dayNumber}-${activityIndex}`);
    try {
      const res = await fetch(`/api/planner/${generationId}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dayNumber, activityIndex, weekNumber, currentTitle, currentMechanic,
          preferences: planner?.preferences,
          planner,
          generationToken: sessionStorage.getItem(`sprout_token_${generationId}`),
        }),
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
          setPlanner({ ...updated });
          savePlanner(generationId, { planner: updated, productType: "weekly", generationToken: sessionStorage.getItem(`sprout_token_${generationId}`) || undefined, savedAt: new Date().toISOString() });
        }
      } else if (planner && "weeks" in planner) {
        const updated = { ...planner } as MonthlyPlanner;
        const week = updated.weeks.find((w) => w.weekNumber === weekNumber);
        const day = week?.days.find((d) => d.dayNumber === dayNumber);
        if (day) {
          day.activities[activityIndex] = data.activity;
          setPlanner({ ...updated });
          savePlanner(generationId, { planner: updated, productType: "monthly", generationToken: sessionStorage.getItem(`sprout_token_${generationId}`) || undefined, savedAt: new Date().toISOString() });
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to regenerate activity. Please try again.");
      setTimeout(() => setError(null), 4000);
    } finally {
      setRegeneratingActivityId(null);
    }
  };

  const handleClearSession = async () => {
    if (!confirm("This will permanently clear all your saved activity plans and preferences. Continue?")) {
      return;
    }
    await fetch("/api/session/clear", { method: "POST" });
    clearSproutStorage();
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
  const daysList = isWeekly
    ? (planner as WeeklyPlanner).days.map((day) => ({ ...day, weekNumber: 1 }))
    : (planner as MonthlyPlanner).weeks.flatMap((week) => week.days.map((day) => ({ ...day, weekNumber: week.weekNumber })));

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-cream)", paddingBottom: "5rem" }}>
      {/* Header */}
      <header
        className="planner-controls"
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
            <button
              type="button"
              onClick={() => window.print()}
              className="btn btn-secondary btn-sm"
              id="btn-download-pdf"
            >
              🖨️ Printable PDF / View
            </button>
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
            <span>FULL PLAN</span> · Age {planner.preferences.ageBand || planner.preferences.child?.ageBand || "4-5"}
          </div>
          <h1 style={{ fontSize: "clamp(2rem, 4vw, 2.75rem)", marginBottom: "0.5rem" }}>
            Your Personalized Activity Plan
          </h1>
          <p style={{ color: "var(--color-stone-500)", fontSize: "1.0625rem" }}>
            {isWeekly ? "7 days" : "4 weeks"} of screen-free activities matched to your selections.
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
            const isRegenerating = regeneratingActivityId === `week-${day.weekNumber}-day-${day.dayNumber}-0`;

            return (
              <article
                key={`${day.weekNumber}-${day.dayNumber}`}
                className="card card-elevated"
                style={{ padding: "2rem", position: "relative" }}
                id={`activity-week-${day.weekNumber}-day-${day.dayNumber}`}
              >
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1rem" }}>
                  <div>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, fontFamily: "'Outfit', sans-serif", color: "var(--color-sage-600)", letterSpacing: "0.05em" }}>
                      {isWeekly ? `DAY ${day.dayNumber}` : `WEEK ${day.weekNumber} · DAY ${day.dayNumber}`}
                    </span>
                    <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.375rem", marginTop: "0.25rem" }}>
                      {act.title.replace(/_/g, " ")}
                    </h3>
                  </div>

                  <div className="planner-controls" style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => setChatActivity(act)}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: "0.8125rem" }}
                      id={`btn-chat-week-${day.weekNumber}-day-${day.dayNumber}`}
                      title="Ask questions, get low-mess adaptations, or advice for reluctant children"
                    >
                      💬 Ask Sprout Coach
                    </button>
                    <button
                      type="button"
                      disabled={isRegenerating}
                      onClick={() => handleRegenerateActivity(
                        day.dayNumber,
                        0,
                        day.weekNumber,
                        act.title,
                        act.noveltySignature?.split(":")[0] || undefined
                      )}
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: "0.8125rem", border: "1px solid var(--color-stone-200)" }}
                      title="Generate a different activity for this day"
                      id={`btn-regenerate-week-${day.weekNumber}-day-${day.dayNumber}`}
                    >
                      {isRegenerating ? "Generating..." : "🔄 Try Different Activity"}
                    </button>
                    {act.evidence?.[0]?.sourceTitle ? (
                      <span className="evidence-badge evidence-badge-strong">Related reading</span>
                    ) : act.rationale ? (
                      <span className="evidence-badge evidence-badge-moderate">Developmental rationale</span>
                    ) : (
                      <span className="evidence-badge evidence-badge-limited">General principle</span>
                    )}
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
                      ✨ Why it may appeal:
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
                    className="planner-controls"
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
                    {activeEvidenceDrawer === act.id ? "Hide related evidence ↑" : "View related evidence details ↓"}
                  </button>

                  {activeEvidenceDrawer === act.id && (() => {
                    const ev = act.evidence?.[0];
                    const url = ev?.freeAccessUrl || ev?.urlDoi;
                    return (
                      <div
                        style={{
                          marginTop: "0.75rem",
                          paddingTop: "0.75rem",
                          borderTop: "1px dashed var(--color-sage-300)",
                          fontSize: "0.75rem",
                          color: "var(--color-stone-600)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.5rem",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                          <div>
                            <span style={{ fontWeight: 700, color: "var(--color-sage-800)", textTransform: "uppercase", fontSize: "0.6875rem", letterSpacing: "0.05em" }}>
                              Related developmental reading
                            </span>
                            {ev?.sourceTitle && (
                              <h5 style={{ margin: "0.2rem 0 0", fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-stone-900)" }}>
                                {ev.sourceTitle}
                              </h5>
                            )}
                          </div>
                          {ev?.evidenceStrength && (
                            <span
                              style={{
                                fontSize: "0.6875rem",
                                padding: "0.15rem 0.5rem",
                                borderRadius: "9999px",
                                background: "var(--color-sage-100)",
                                color: "var(--color-sage-700)",
                                fontWeight: 600,
                                textTransform: "capitalize",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {ev.evidenceStrength} evidence
                            </span>
                          )}
                        </div>

                        {(ev?.organizationAuthors || ev?.publicationYear) && (
                          <p style={{ margin: 0, color: "var(--color-stone-500)", fontSize: "0.75rem" }}>
                            {ev.organizationAuthors}
                            {ev.publicationYear ? ` (${ev.publicationYear})` : ""}
                            {ev.sourceType ? ` • ${ev.sourceType}` : ""}
                          </p>
                        )}

                        {(ev?.relevantFindingSummary || ev?.supportExplanation) && (
                          <div style={{ background: "white", padding: "0.625rem 0.75rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-sage-200)" }}>
                            <span style={{ fontWeight: 600, color: "var(--color-stone-800)", display: "block", marginBottom: "0.15rem" }}>
                              Source summary:
                            </span>
                            <p style={{ margin: 0, lineHeight: 1.5 }}>
                              {ev.relevantFindingSummary || ev.supportExplanation}
                            </p>
                          </div>
                        )}

                        {ev?.activityApplicationSentence && (
                          <p style={{ margin: 0, lineHeight: 1.45, fontStyle: "italic", color: "var(--color-sage-900)" }}>
                            <strong>Activity connection:</strong> {ev.activityApplicationSentence}
                          </p>
                        )}

                        {url && (
                          <div style={{ marginTop: "0.25rem" }}>
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: "var(--color-sage-700)",
                                textDecoration: "underline",
                                fontWeight: 600,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.25rem",
                              }}
                            >
                              <span>↗ Open access / study citation</span>
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })()}
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
        <div className="planner-controls"><FeedbackWidget generationId={generationId} /></div>

        {/* Activity Chat Drawer */}
        {chatActivity && (
          <ActivityChatDrawer
            activity={chatActivity}
            childAge={planner.preferences.ageBand || planner.preferences.child?.ageBand || "4-5"}
            isOpen={!!chatActivity}
            onClose={() => setChatActivity(null)}
          />
        )}
        <style jsx global>{`
          @media print {
            @page { size: auto; margin: 12mm; }
            .planner-controls { display: none !important; }
            body { background: white !important; }
            article { break-inside: avoid; box-shadow: none !important; }
            main { max-width: none !important; padding-top: 0 !important; }
          }
        `}</style>
      </main>
    </div>
  );
}
