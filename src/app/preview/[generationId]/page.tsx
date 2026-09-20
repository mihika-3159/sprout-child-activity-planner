"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PlannerPreviewPayload } from "@/lib/generation/composer";
import { formatPrice, getProduct } from "@/lib/config/products";
import { formatMaterial, formatGoal, formatSupervision, humanize } from "@/lib/utils/formatters";

export default function PreviewPage() {
  const params = useParams();
  const router = useRouter();
  const generationId = params.generationId as string;

  const [preview, setPreview] = useState<PlannerPreviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEvidenceDrawer, setShowEvidenceDrawer] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    async function loadPreview() {
      try {
        const tokenFromStorage = typeof window !== "undefined" ? sessionStorage.getItem(`sprout_token_${generationId}`) : null;
        const searchToken = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("token") : null;
        const effectiveToken = searchToken || tokenFromStorage;

        const res = await fetch(`/api/planner/${generationId}${effectiveToken ? `?token=${encodeURIComponent(effectiveToken)}` : ""}`, {
          headers: effectiveToken ? { "X-Generation-Token": effectiveToken } : {},
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load preview");
        }

        if (data.isUnlocked) {
          // If already unlocked, redirect directly to full planner
          router.replace(`/planner/${generationId}${effectiveToken ? `?token=${encodeURIComponent(effectiveToken)}` : ""}`);
          return;
        }

        setPreview(data.preview);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load plan preview");
      } finally {
        setLoading(false);
      }
    }
    if (generationId) {
      loadPreview();
    }
  }, [generationId, router]);

  const handleCheckout = async (productType: "weekly" | "monthly" | "yearly") => {
    setCheckingOut(true);
    try {
      const res = await fetch("/api/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationId, productType }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Checkout initiation failed");
      }
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to start checkout");
      setCheckingOut(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-cream)" }}>
        <div style={{ textAlign: "center" }}>
          <p className="animate-pulse" style={{ fontSize: "2rem", marginBottom: "1rem" }}>🌱</p>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.25rem", color: "var(--color-stone-800)" }}>
            Loading your personalised plan preview...
          </h2>
        </div>
      </div>
    );
  }

  if (error || !preview) {
    return (
      <div style={{ minHeight: "100vh", padding: "3rem 1.5rem", background: "var(--color-cream)" }}>
        <div className="container" style={{ maxWidth: "600px", textAlign: "center" }}>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", color: "var(--color-error)", marginBottom: "1rem" }}>
            Plan Not Found
          </h2>
          <p style={{ color: "var(--color-stone-600)", marginBottom: "1.5rem" }}>
            {error || "Could not retrieve this preview session."}
          </p>
          <Link href="/planner" className="btn btn-primary">
            Create a New Plan
          </Link>
        </div>
      </div>
    );
  }

  const { day1Activity, day2Teaser, preferencesSummary, productType } = preview;
  const productConfig = getProduct(productType);

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-cream)", paddingBottom: "4rem" }}>
      {/* Top Banner */}
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
          <button
            onClick={() => handleCheckout(productType)}
            disabled={checkingOut}
            className="btn btn-primary btn-sm"
            id="btn-unlock-header"
          >
            Unlock Full Plan ({formatPrice(productConfig)})
          </button>
        </div>
      </header>

      <main className="container" style={{ maxWidth: "840px", paddingTop: "2.5rem" }}>
        {/* Title and Badge */}
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "var(--color-sage-100)", color: "var(--color-sage-700)", padding: "0.25rem 0.75rem", borderRadius: "var(--radius-full)", fontSize: "0.75rem", fontWeight: 600, fontFamily: "'Outfit', sans-serif", marginBottom: "0.75rem" }}>
            <span>PLAN PREVIEW</span> · Age {preferencesSummary.ageBand}
          </div>
          <h1 style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)", marginBottom: "0.5rem" }}>
            Personalised {productType === "monthly" ? "4-Week" : "7-Day"} Screen-Free Plan
          </h1>
          <p style={{ color: "var(--color-stone-500)", fontSize: "1rem" }}>
            Tailored to interests in {preferencesSummary.interests.join(", ")} with {preferencesSummary.duration} min activities.
          </p>
        </div>

        {/* Full Day 1 Activity (Free Preview) */}
        <section aria-labelledby="day1-heading" style={{ marginBottom: "2.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2 id="day1-heading" style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.25rem", color: "var(--color-sage-600)" }}>
              Day 1 (Full Free Preview)
            </h2>
            {day1Activity.evidence?.[0]?.sourceTitle ? (
              <span className="evidence-badge evidence-badge-strong">Research-linked</span>
            ) : day1Activity.rationale ? (
              <span className="evidence-badge evidence-badge-moderate">Developmental rationale</span>
            ) : (
              <span className="evidence-badge evidence-badge-limited">General principle</span>
            )}
          </div>

          <div className="card card-elevated" style={{ padding: "2rem" }}>
            <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.5rem", marginBottom: "0.75rem", color: "var(--color-stone-900)" }}>
              {day1Activity.title}
            </h3>
            <p style={{ color: "var(--color-stone-700)", fontSize: "1rem", lineHeight: 1.6, marginBottom: "1.5rem" }}>
              {day1Activity.description}
            </p>

            {/* Why it's here */}
            <div
              style={{
                background: "var(--color-sage-50)",
                border: "1px solid var(--color-sage-200)",
                borderRadius: "var(--radius-md)",
                padding: "1rem 1.25rem",
                marginBottom: "1.5rem",
              }}
            >
              <p style={{ fontSize: "0.8125rem", fontWeight: 700, fontFamily: "'Outfit', sans-serif", color: "var(--color-sage-700)", marginBottom: "0.375rem" }}>
                Why it's here (Evidence-Grounded Rationale)
              </p>
              <p style={{ fontSize: "0.875rem", color: "var(--color-stone-600)", lineHeight: 1.6 }}>
                {day1Activity.rationale}
              </p>
              <button
                type="button"
                onClick={() => setShowEvidenceDrawer(!showEvidenceDrawer)}
                style={{
                  marginTop: "0.5rem",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: "var(--color-sage-600)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
                id="btn-toggle-evidence-drawer"
              >
                {showEvidenceDrawer ? "Hide scientific citation ↑" : "Inspect scientific study & citation ↓"}
              </button>

              {showEvidenceDrawer && day1Activity.evidence && (
                <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px dashed var(--color-sage-300)", fontSize: "0.8125rem", color: "var(--color-stone-600)" }}>
                  <p style={{ fontWeight: 600, color: "var(--color-stone-800)" }}>Supporting Research:</p>
                  <p>{day1Activity.evidence[0]?.supportExplanation}</p>
                </div>
              )}
            </div>

            {/* Timing & Setup */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginBottom: "1.5rem" }}>
              <div style={{ background: "var(--color-cream)", borderRadius: "var(--radius-sm)", padding: "0.75rem", textAlign: "center" }}>
                <p style={{ fontSize: "0.75rem", color: "var(--color-stone-500)" }}>Parent Setup</p>
                <p style={{ fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>~{day1Activity.setupMinutes} min</p>
              </div>
              <div style={{ background: "var(--color-cream)", borderRadius: "var(--radius-sm)", padding: "0.75rem", textAlign: "center" }}>
                <p style={{ fontSize: "0.75rem", color: "var(--color-stone-500)" }}>Activity Duration</p>
                <p style={{ fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>
                  {day1Activity.activityMinutes.min}–{day1Activity.activityMinutes.max} min
                </p>
              </div>
              <div style={{ background: "var(--color-cream)", borderRadius: "var(--radius-sm)", padding: "0.75rem", textAlign: "center" }}>
                <p style={{ fontSize: "0.75rem", color: "var(--color-stone-500)" }}>Independence</p>
                <p style={{ fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>
                  {formatSupervision(day1Activity.supervisionLevel)}
                </p>
              </div>
            </div>

            {/* Step-by-Step Instructions */}
            <div style={{ marginBottom: "1.5rem" }}>
              <p style={{ fontWeight: 700, fontFamily: "'Outfit', sans-serif", marginBottom: "0.5rem" }}>
                Instructions for Child
              </p>
              <ol style={{ paddingLeft: "1.25rem", color: "var(--color-stone-700)", lineHeight: 1.6, fontSize: "0.9375rem" }}>
                {day1Activity.instructions.map((step, idx) => (
                  <li key={idx} style={{ marginBottom: "0.375rem" }}>{step}</li>
                ))}
              </ol>
            </div>

            {/* Materials */}
            <div>
              <p style={{ fontWeight: 700, fontFamily: "'Outfit', sans-serif", marginBottom: "0.5rem" }}>
                Materials Needed
              </p>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {day1Activity.materials.map((mat) => (
                  <span
                    key={mat}
                    style={{
                      background: "white",
                      border: "1px solid var(--color-stone-200)",
                      borderRadius: "var(--radius-full)",
                      padding: "0.25rem 0.625rem",
                      fontSize: "0.8125rem",
                      color: "var(--color-stone-600)",
                    }}
                  >
                    {formatMaterial(mat)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Day 2 Abbreviated Teaser */}
        <section style={{ marginBottom: "2.5rem" }}>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.25rem", color: "var(--color-stone-700)", marginBottom: "1rem" }}>
            Day 2 (Glimpse)
          </h2>
          <div className="card" style={{ padding: "1.5rem", borderLeft: "4px solid var(--color-sage-400)" }}>
            <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.25rem", marginBottom: "0.25rem" }}>
              {day2Teaser.title.replace(/_/g, " ")}
            </h3>
            <p style={{ color: "var(--color-stone-500)", fontSize: "0.875rem", marginBottom: "0.75rem" }}>
              {day2Teaser.descriptionSnippet.replace(/_/g, " ")}
            </p>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <span className="evidence-badge evidence-badge-moderate">
                {day2Teaser.developmentalDomains.map((d) => formatGoal(d)).join(" · ")}
              </span>
              <span style={{ fontSize: "0.75rem", color: "var(--color-stone-400)", alignSelf: "center" }}>
                ~{day2Teaser.estimatedMinutes} min duration
              </span>
            </div>
          </div>
        </section>

        {/* Remaining Days Gated Paywall Card (Strict Server-Side Gating) */}
        <section aria-labelledby="locked-heading" style={{ marginBottom: "3rem" }}>
          <div
            className="card paywall-lock"
            style={{
              padding: "2.5rem 2rem",
              background: "white",
              textAlign: "center",
              border: "2px dashed var(--color-stone-300)",
            }}
          >
            <div style={{ maxWidth: "520px", margin: "0 auto", position: "relative", zIndex: 10 }}>
              <span aria-hidden="true" style={{ fontSize: "2.5rem", display: "block", marginBottom: "1rem" }}>
                🔒
              </span>
              <h2 id="locked-heading" style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.75rem", marginBottom: "0.75rem" }}>
                Unlock All {preview.totalActivitiesCount} Days & PDF Download
              </h2>
              <p style={{ color: "var(--color-stone-600)", lineHeight: 1.6, marginBottom: "1.75rem", fontSize: "0.9375rem" }}>
                Get the complete evidence-grounded curriculum, printable PDF checklists, and single-click activity regeneration for your entire plan.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", alignItems: "center" }}>
                <button
                  type="button"
                  disabled={checkingOut}
                  onClick={() => handleCheckout(productType)}
                  className="btn btn-primary btn-lg"
                  style={{ width: "100%", maxWidth: "380px" }}
                  id="btn-unlock-main"
                >
                  {checkingOut ? "Redirecting to checkout..." : `Unlock Plan — ${formatPrice(productConfig)}`}
                </button>
                <p style={{ fontSize: "0.8125rem", color: "var(--color-stone-400)" }}>
                  Secure tokenized checkout · No subscriptions · Instant PDF access
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
