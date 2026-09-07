"use client";

import { useState } from "react";

interface FeedbackWidgetProps {
  generationId?: string;
}

const CATEGORIES = [
  { id: "activities", label: "🎯 Activity Quality" },
  { id: "age", label: "👶 Age Appropriateness" },
  { id: "materials", label: "📦 Materials & Setup" },
  { id: "wishlist", label: "💡 Feature Ideas" },
  { id: "general", label: "💬 General Thoughts" },
];

const RATING_LABELS: Record<number, string> = {
  1: "Could be better",
  2: "It was okay",
  3: "Good ideas",
  4: "Really enjoyed it",
  5: "Loved it!",
};

export default function FeedbackWidget({ generationId }: FeedbackWidgetProps) {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [category, setCategory] = useState<string>("activities");
  const [feedback, setFeedback] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim() && !rating) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          category,
          feedback: generationId ? `[Plan: ${generationId}] ${feedback.trim()}` : feedback.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit feedback");
      }

      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        marginTop: "3rem",
        marginBottom: "2rem",
        background: "white",
        border: "1.5px solid var(--color-sage-200)",
        borderRadius: "var(--radius-lg)",
        padding: "2rem",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div style={{ marginBottom: "1.25rem", textAlign: "center" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            background: "var(--color-sage-50)",
            color: "var(--color-sage-700)",
            padding: "0.25rem 0.75rem",
            borderRadius: "9999px",
            fontSize: "0.75rem",
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            marginBottom: "0.5rem",
          }}
        >
          <span>🌱</span> Free Demo & Community Beta
        </div>
        <h3
          style={{
            fontSize: "1.375rem",
            fontWeight: 700,
            fontFamily: "'Outfit', sans-serif",
            color: "var(--color-stone-800)",
            marginBottom: "0.375rem",
          }}
        >
          How does this activity plan look to you?
        </h3>
        <p style={{ color: "var(--color-stone-500)", fontSize: "0.875rem", maxWidth: "480px", margin: "0 auto" }}>
          We’re sharing Sprout early to build the most helpful screen-free tool for parents. We’d love your honest feedback!
        </p>
      </div>

      {submitted ? (
        <div
          style={{
            background: "var(--color-success-bg)",
            border: "1px solid var(--color-success)",
            borderRadius: "var(--radius-md)",
            padding: "1.5rem",
            textAlign: "center",
            color: "var(--color-stone-800)",
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>💚</div>
          <h4 style={{ fontWeight: 700, fontSize: "1.125rem", color: "var(--color-stone-800)", marginBottom: "0.25rem" }}>
            Thank you for helping us grow!
          </h4>
          <p style={{ fontSize: "0.875rem", color: "var(--color-stone-600)", marginBottom: "1rem" }}>
            Your feedback has been anonymously saved and will directly shape our future activity designs.
          </p>
          <button
            type="button"
            onClick={() => {
              setSubmitted(false);
              setFeedback("");
            }}
            style={{
              background: "white",
              border: "1px solid var(--color-stone-300)",
              borderRadius: "var(--radius-sm)",
              padding: "0.375rem 0.875rem",
              fontSize: "0.8125rem",
              cursor: "pointer",
              color: "var(--color-stone-700)",
            }}
          >
            Leave another note
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Star Rating */}
          <div style={{ textAlign: "center" }}>
            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-stone-600)", marginBottom: "0.375rem" }}>
              Overall Impression
            </label>
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "0.375rem" }}>
              {[1, 2, 3, 4, 5].map((star) => {
                const isFilled = (hoverRating ?? rating) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(null)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "1.75rem",
                      lineHeight: 1,
                      padding: "0.25rem",
                      color: isFilled ? "var(--color-amber-400)" : "var(--color-stone-300)",
                      transition: "transform 0.1s ease, color 0.1s ease",
                      transform: (hoverRating ?? rating) === star ? "scale(1.15)" : "scale(1)",
                    }}
                    aria-label={`${star} star`}
                  >
                    ★
                  </button>
                );
              })}
            </div>
            <p style={{ fontSize: "0.75rem", color: "var(--color-stone-500)", marginTop: "0.25rem" }}>
              {RATING_LABELS[hoverRating ?? rating]}
            </p>
          </div>

          {/* Category Chips */}
          <div>
            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-stone-600)", marginBottom: "0.5rem" }}>
              Topic:
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    style={{
                      padding: "0.375rem 0.75rem",
                      borderRadius: "9999px",
                      fontSize: "0.8125rem",
                      border: isSelected ? "1.5px solid var(--color-sage-600)" : "1px solid var(--color-stone-200)",
                      background: isSelected ? "var(--color-sage-100)" : "var(--color-cream)",
                      color: isSelected ? "var(--color-sage-800)" : "var(--color-stone-700)",
                      fontWeight: isSelected ? 600 : 400,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Text Area */}
          <div>
            <label
              htmlFor="feedback-text"
              style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-stone-600)", marginBottom: "0.375rem" }}
            >
              Your thoughts or suggestions:
            </label>
            <textarea
              id="feedback-text"
              rows={3}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="What did you like? What was confusing or missing? Any features you wish it had?"
              style={{
                width: "100%",
                padding: "0.75rem",
                borderRadius: "var(--radius-md)",
                border: "1.5px solid var(--color-stone-200)",
                fontSize: "0.875rem",
                fontFamily: "inherit",
                resize: "vertical",
                outline: "none",
                transition: "border-color 0.15s ease",
                backgroundColor: "var(--color-cream-50)",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--color-sage-500)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--color-stone-200)")}
            />
          </div>

          {error && (
            <div
              style={{
                background: "var(--color-error-bg)",
                border: "1px solid var(--color-error)",
                color: "var(--color-error)",
                padding: "0.5rem 0.75rem",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.8125rem",
              }}
            >
              {error}
            </div>
          )}

          {/* Submit Action */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
            <p style={{ fontSize: "0.75rem", color: "var(--color-stone-400)" }}>
              🔒 Zero trackers. Anonymous & privacy protected.
            </p>
            <button
              type="submit"
              disabled={submitting}
              style={{
                background: "var(--color-sage-600)",
                color: "white",
                border: "none",
                borderRadius: "var(--radius-md)",
                padding: "0.625rem 1.25rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                fontFamily: "'Outfit', sans-serif",
                cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.7 : 1,
                boxShadow: "var(--shadow-sm)",
              }}
            >
              {submitting ? "Sending..." : "Submit Feedback"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
