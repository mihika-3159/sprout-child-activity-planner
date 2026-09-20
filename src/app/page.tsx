"use client";

import Link from "next/link";
import { useState } from "react";
import { PLANNER_PRODUCTS, formatPrice } from "@/lib/config/products";

// ─── Navigation ───────────────────────────────────────────────────────────────
function Nav() {
  return (
    <nav
      role="navigation"
      aria-label="Main navigation"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(250, 248, 244, 0.92)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--color-stone-200)",
        padding: "1rem 0",
      }}
    >
      <div className="container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link
          href="/"
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontWeight: 800,
            fontSize: "1.375rem",
            color: "var(--color-sage-600)",
            textDecoration: "none",
            letterSpacing: "-0.03em",
          }}
          aria-label="Sprout Planner home"
        >
          🌱 Sprout
        </Link>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <Link href="#how-it-works" className="btn btn-ghost btn-sm" aria-label="See how it works">
            How it works
          </Link>
          <Link href="#pricing" className="btn btn-ghost btn-sm">
            Pricing
          </Link>
          <Link href="/planner" className="btn btn-primary btn-sm" id="nav-cta">
            Build my plan
          </Link>
        </div>
      </div>
    </nav>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      style={{
        padding: "6rem 0 5rem",
        background: "linear-gradient(160deg, var(--color-cream) 0%, var(--color-cream-50) 50%, var(--color-sage-50) 100%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative background shapes */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "-20%",
          right: "-10%",
          width: "500px",
          height: "500px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,199,131,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: "0",
          left: "-5%",
          width: "300px",
          height: "300px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(252,211,77,0.10) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div className="container" style={{ position: "relative" }}>
        <div style={{ maxWidth: "680px" }}>
          {/* Pill label */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "var(--color-sage-100)",
              color: "var(--color-sage-700)",
              padding: "0.375rem 0.875rem",
              borderRadius: "var(--radius-full)",
              fontSize: "0.8125rem",
              fontWeight: 600,
              fontFamily: "'Outfit', sans-serif",
              marginBottom: "1.5rem",
              letterSpacing: "0.01em",
            }}
          >
            <span role="img" aria-label="Seedling">🌱</span>
            Evidence-grounded activity planning
          </div>

          <h1
            id="hero-heading"
            style={{
              fontSize: "clamp(2.5rem, 6vw, 4rem)",
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              marginBottom: "1.5rem",
              color: "var(--color-stone-900)",
            }}
          >
            Less screen time{" "}
            <span style={{ color: "var(--color-sage-500)" }}>planning.</span>
            <br />
            More family time.
          </h1>

          <p
            style={{
              fontSize: "clamp(1.0625rem, 2.5vw, 1.25rem)",
              color: "var(--color-stone-500)",
              lineHeight: 1.6,
              marginBottom: "2.5rem",
              maxWidth: "540px",
            }}
          >
            Tell us what your child enjoys, what you have at home, and how much
            involvement you want. We'll build a personalised week of
            evidence-informed, screen-free activities — no searching required.
          </p>

          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <Link
              href="/planner"
              className="btn btn-primary btn-lg"
              id="hero-primary-cta"
            >
              Build my activity plan
              <span aria-hidden="true">→</span>
            </Link>
            <Link
              href="#example"
              className="btn btn-secondary btn-lg"
              id="hero-secondary-cta"
            >
              See an example
            </Link>
          </div>

          {/* Trust signals */}
          <div
            style={{
              display: "flex",
              gap: "1.5rem",
              marginTop: "2.5rem",
              flexWrap: "wrap",
            }}
          >
            {[
              { emoji: "🔒", text: "No sign-up required" },
              { emoji: "📚", text: "Evidence-grounded" },
              { emoji: "🏠", text: "Uses things you have at home" },
            ].map((item) => (
              <div
                key={item.text}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontSize: "0.875rem",
                  color: "var(--color-stone-500)",
                  fontWeight: 500,
                }}
              >
                <span role="img" aria-hidden="true">{item.emoji}</span>
                {item.text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    {
      number: "01",
      icon: "💬",
      title: "Tell us what works for your family",
      description:
        "Share your child's age, interests, what materials you have at home, and how much involvement you want. No names, no accounts.",
    },
    {
      number: "02",
      icon: "🧠",
      title: "We build activities around those constraints",
      description:
        "Our system retrieves relevant evidence and uses it to compose activities tailored specifically to your answers — not a generic list.",
    },
    {
      number: "03",
      icon: "👁️",
      title: "Preview your personalised plan",
      description:
        "See the first day in full before deciding. Each activity includes why it was suggested and what evidence supports it.",
    },
    {
      number: "04",
      icon: "⬇️",
      title: "Download when you're happy",
      description:
        "Get a printable PDF or clean HTML version of your weekly or monthly plan, ready to use.",
    },
  ];

  return (
    <section
      id="how-it-works"
      aria-labelledby="how-heading"
      className="section"
      style={{ background: "white" }}
    >
      <div className="container">
        <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
          <h2 id="how-heading" className="section-title">
            How it works
          </h2>
          <p className="section-subtitle" style={{ margin: "0.75rem auto 0" }}>
            Four steps from nothing to a personalised activity plan.
          </p>
        </div>

        <ol
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "1.5rem",
            listStyle: "none",
            counterReset: "steps",
          }}
          aria-label="Steps to create your plan"
        >
          {steps.map((step, i) => (
            <li
              key={step.number}
              className="card"
              style={{
                padding: "1.75rem",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
                animationDelay: `${i * 80}ms`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span
                  aria-hidden="true"
                  style={{ fontSize: "1.75rem" }}
                >
                  {step.icon}
                </span>
                <span
                  style={{
                    fontFamily: "'Outfit', sans-serif",
                    fontSize: "0.8125rem",
                    fontWeight: 700,
                    color: "var(--color-sage-400)",
                    letterSpacing: "0.1em",
                  }}
                >
                  STEP {step.number}
                </span>
              </div>
              <h3
                style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: "1.125rem",
                  fontWeight: 700,
                  color: "var(--color-stone-900)",
                }}
              >
                {step.title}
              </h3>
              <p style={{ fontSize: "0.9375rem", color: "var(--color-stone-500)", lineHeight: 1.6 }}>
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ─── Why Parents Use It ───────────────────────────────────────────────────────
function WhyParents() {
  const benefits = [
    {
      icon: "🔍",
      title: "Less searching",
      desc: "Stop trawling Pinterest boards and parenting blogs. Describe your situation once and get relevant suggestions.",
    },
    {
      icon: "⚙️",
      title: "Less preparation",
      desc: "Activities use things already at home. You won't need to make a special trip to the craft shop.",
    },
    {
      icon: "🧒",
      title: "Appropriate independence",
      desc: "Tell us how involved you want to be. We'll prioritise activities that match that — safely.",
    },
    {
      icon: "🎯",
      title: "Personalised interests",
      desc: "If your child loves dinosaurs, space, or cooking, activities reflect that — not a one-size-fits-all list.",
    },
    {
      icon: "🔄",
      title: "Genuine variety",
      desc: "Our novelty system ensures you won't receive the same activity renamed across a week.",
    },
    {
      icon: "📖",
      title: "Evidence-grounded",
      desc: "Suggestions are grounded in peer-reviewed developmental research, not AI imagination or parenting blogs — though no activity catalogue is exhaustive.",
    },
  ];

  return (
    <section
      aria-labelledby="why-heading"
      className="section"
      style={{ background: "var(--color-cream)" }}
    >
      <div className="container">
        <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
          <h2 id="why-heading" className="section-title">
            Why parents use Sprout
          </h2>
          <p className="section-subtitle" style={{ margin: "0.75rem auto 0" }}>
            Planning meaningful activities takes time. We do that work for you.
          </p>
        </div>

        <ul
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "1.25rem",
            listStyle: "none",
          }}
        >
          {benefits.map((b) => (
            <li
              key={b.title}
              className="card card-hover"
              style={{ padding: "1.5rem" }}
            >
              <span aria-hidden="true" style={{ fontSize: "1.75rem", display: "block", marginBottom: "0.875rem" }}>
                {b.icon}
              </span>
              <h3
                style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: "1.0625rem",
                  fontWeight: 700,
                  marginBottom: "0.5rem",
                }}
              >
                {b.title}
              </h3>
              <p style={{ fontSize: "0.9375rem", color: "var(--color-stone-500)", lineHeight: 1.6 }}>
                {b.desc}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ─── Evidence Section ─────────────────────────────────────────────────────────
function EvidenceSection() {
  return (
    <section
      id="evidence"
      aria-labelledby="evidence-heading"
      className="section"
      style={{ background: "var(--color-sage-800)" }}
    >
      <div className="container">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "4rem",
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{
                display: "inline-block",
                background: "rgba(255,255,255,0.12)",
                color: "var(--color-sage-200)",
                padding: "0.375rem 0.875rem",
                borderRadius: "var(--radius-full)",
                fontSize: "0.8125rem",
                fontWeight: 600,
                fontFamily: "'Outfit', sans-serif",
                marginBottom: "1.25rem",
                letterSpacing: "0.05em",
              }}
            >
              HOW EVIDENCE WORKS
            </div>
            <h2
              id="evidence-heading"
              style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)",
                fontWeight: 800,
                color: "white",
                letterSpacing: "-0.02em",
                marginBottom: "1.25rem",
                lineHeight: 1.15,
              }}
            >
              AI creates the plan.
              <br />
              <span style={{ color: "var(--color-sage-300)" }}>
                Approved evidence constrains it.
              </span>
            </h2>
            <p style={{ color: "var(--color-sage-200)", fontSize: "1rem", lineHeight: 1.7, marginBottom: "1.5rem" }}>
              Sprout uses a retrieval-augmented approach. Before any activity is
              suggested, the system checks an approved library of research from
              sources like PubMed Central and educational research databases.
            </p>
            <p style={{ color: "var(--color-sage-300)", fontSize: "0.9375rem", lineHeight: 1.7 }}>
              If the evidence doesn't support a claim, Sprout won't make it.
              The AI's job is creative activity design — not inventing child
              development science.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {[
              {
                label: "What the AI does",
                items: ["Creatively combines activity concepts", "Personalises to your child's interests", "Adapts to your constraints", "Writes clear parent-friendly instructions"],
                color: "var(--color-sage-600)",
                border: "var(--color-sage-500)",
              },
              {
                label: "What the evidence does",
                items: ["Confirms developmental appropriateness", "Supports age-related recommendations", "Guides supervision requirements", "Validates safety considerations"],
                color: "rgba(255,255,255,0.06)",
                border: "rgba(255,255,255,0.15)",
              },
            ].map((box) => (
              <div
                key={box.label}
                style={{
                  background: box.color,
                  border: `1px solid ${box.border}`,
                  borderRadius: "var(--radius-lg)",
                  padding: "1.25rem 1.5rem",
                }}
              >
                <p
                  style={{
                    fontSize: "0.8125rem",
                    fontWeight: 700,
                    fontFamily: "'Outfit', sans-serif",
                    color: "var(--color-sage-200)",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    marginBottom: "0.75rem",
                  }}
                >
                  {box.label}
                </p>
                <ul style={{ display: "flex", flexDirection: "column", gap: "0.5rem", listStyle: "none" }}>
                  {box.items.map((item) => (
                    <li
                      key={item}
                      style={{
                        display: "flex",
                        gap: "0.5rem",
                        fontSize: "0.9375rem",
                        color: "rgba(255,255,255,0.85)",
                      }}
                    >
                      <span aria-hidden="true" style={{ color: "var(--color-sage-300)", flexShrink: 0 }}>✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Privacy Section ──────────────────────────────────────────────────────────
function PrivacySection() {
  return (
    <section
      id="privacy"
      aria-labelledby="privacy-heading"
      className="section"
      style={{ background: "white" }}
    >
      <div className="container">
        <div style={{ maxWidth: "700px", margin: "0 auto", textAlign: "center" }}>
          <span aria-hidden="true" style={{ fontSize: "2.5rem", display: "block", marginBottom: "1rem" }}>
            🔒
          </span>
          <h2 id="privacy-heading" className="section-title">
            We don't need to know who your child is
          </h2>
          <p
            style={{
              fontSize: "1.125rem",
              color: "var(--color-stone-500)",
              lineHeight: 1.7,
              marginBottom: "2.5rem",
            }}
          >
            To build a personalised activity plan, we need to know what kinds of
            activities might suit your family — not who your family is.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
              textAlign: "left",
              marginBottom: "2rem",
            }}
          >
            <div
              className="card"
              style={{ padding: "1.25rem", background: "var(--color-error-bg)" }}
            >
              <p
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: 700,
                  fontFamily: "'Outfit', sans-serif",
                  color: "var(--color-error)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "0.75rem",
                }}
              >
                We never ask for
              </p>
              <ul style={{ display: "flex", flexDirection: "column", gap: "0.5rem", listStyle: "none" }}>
                {[
                  "Child's name or photo",
                  "Exact date of birth",
                  "Email address (to generate)",
                  "School or nursery name",
                  "Home address",
                  "Phone number",
                ].map((item) => (
                  <li key={item} style={{ display: "flex", gap: "0.5rem", fontSize: "0.875rem", color: "var(--color-stone-600)" }}>
                    <span aria-hidden="true" style={{ color: "var(--color-error)", flexShrink: 0 }}>✗</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div
              className="card"
              style={{ padding: "1.25rem", background: "var(--color-success-bg)" }}
            >
              <p
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: 700,
                  fontFamily: "'Outfit', sans-serif",
                  color: "var(--color-success)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "0.75rem",
                }}
              >
                We only ask for
              </p>
              <ul style={{ display: "flex", flexDirection: "column", gap: "0.5rem", listStyle: "none" }}>
                {[
                  "Age band (e.g. 4–5)",
                  "General interests",
                  "Home environment",
                  "Materials available",
                  "Time available",
                  "Desired independence level",
                ].map((item) => (
                  <li key={item} style={{ display: "flex", gap: "0.5rem", fontSize: "0.875rem", color: "var(--color-stone-600)" }}>
                    <span aria-hidden="true" style={{ color: "var(--color-success)", flexShrink: 0 }}>✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p style={{ fontSize: "0.875rem", color: "var(--color-stone-400)" }}>
            Sessions are anonymous. No account is required to generate your plan.
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── Example Preview ──────────────────────────────────────────────────────────
function ExamplePreview() {
  return (
    <section
      id="example"
      aria-labelledby="example-heading"
      className="section"
      style={{ background: "var(--color-cream-50)" }}
    >
      <div className="container">
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <h2 id="example-heading" className="section-title">
            What your plan looks like
          </h2>
          <p className="section-subtitle" style={{ margin: "0.75rem auto 0" }}>
            A sample activity from a 6–7 year old's weekly plan.
          </p>
        </div>

        <div
          className="card card-elevated"
          style={{ maxWidth: "700px", margin: "0 auto", padding: "2rem" }}
        >
          {/* Activity header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: "1.25rem",
              gap: "1rem",
              flexWrap: "wrap",
            }}
          >
            <div>
              <p style={{ fontSize: "0.8125rem", color: "var(--color-sage-500)", fontWeight: 600, fontFamily: "'Outfit', sans-serif", marginBottom: "0.25rem" }}>
                MONDAY · CREATIVE
              </p>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.375rem", fontWeight: 700, color: "var(--color-stone-900)" }}>
                Story Map Adventure
              </h3>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
              <span className="evidence-badge evidence-badge-strong">Strong evidence</span>
            </div>
          </div>

          <p style={{ color: "var(--color-stone-600)", marginBottom: "1.25rem", lineHeight: 1.65, fontSize: "0.9375rem" }}>
            Draw a map of an imaginary world — forests, mountains, castles, and
            secret paths — then write or dictate a short story about a character
            who lives there.
          </p>

          {/* Why it's here */}
          <div
            style={{
              background: "var(--color-sage-50)",
              border: "1px solid var(--color-sage-200)",
              borderRadius: "var(--radius-md)",
              padding: "1rem 1.125rem",
              marginBottom: "1.25rem",
            }}
          >
            <p style={{ fontSize: "0.8125rem", fontWeight: 700, fontFamily: "'Outfit', sans-serif", color: "var(--color-sage-700)", marginBottom: "0.375rem" }}>
              Why it's here
            </p>
            <p style={{ fontSize: "0.875rem", color: "var(--color-stone-600)", lineHeight: 1.6 }}>
              Combines narrative drawing with emergent literacy. Research
              suggests this type of imaginative mapping supports spatial
              reasoning and story-structure understanding in this age group.
            </p>
          </div>

          {/* Meta row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "0.75rem",
              marginBottom: "1.25rem",
            }}
          >
            {[
              { label: "Setup", value: "~3 min" },
              { label: "Activity", value: "20–35 min" },
              { label: "After setup", value: "Mostly independent" },
            ].map((m) => (
              <div
                key={m.label}
                style={{
                  background: "var(--color-cream)",
                  borderRadius: "var(--radius-sm)",
                  padding: "0.625rem 0.75rem",
                  textAlign: "center",
                }}
              >
                <p style={{ fontSize: "0.75rem", color: "var(--color-stone-400)", fontWeight: 500 }}>{m.label}</p>
                <p style={{ fontSize: "0.875rem", color: "var(--color-stone-700)", fontWeight: 600, fontFamily: "'Outfit', sans-serif" }}>{m.value}</p>
              </div>
            ))}
          </div>

          {/* You'll need */}
          <div style={{ marginBottom: "1rem" }}>
            <p style={{ fontSize: "0.8125rem", fontWeight: 700, fontFamily: "'Outfit', sans-serif", color: "var(--color-stone-700)", marginBottom: "0.5rem" }}>
              You'll need
            </p>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {["Paper", "Pencils or crayons", "Imagination"].map((item) => (
                <span
                  key={item}
                  style={{
                    background: "white",
                    border: "1px solid var(--color-stone-200)",
                    borderRadius: "var(--radius-full)",
                    padding: "0.25rem 0.625rem",
                    fontSize: "0.8125rem",
                    color: "var(--color-stone-600)",
                  }}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* Evidence drawer toggle */}
          <button
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontSize: "0.875rem",
              color: "var(--color-sage-600)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              fontWeight: 500,
            }}
            aria-label="View evidence for this recommendation"
          >
            <span aria-hidden="true">📖</span>
            Why was this recommended?
          </button>
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────
function Pricing() {
  const products = [
    {
      key: "weekly" as const,
      icon: "📅",
      features: [
        "7 personalised days",
        "1–3 activities per day",
        "Related evidence per activity",
        "Printable PDF",
        "Regenerate any activity",
        "Materials overview",
      ],
      highlight: false,
    },
    {
      key: "monthly" as const,
      icon: "📆",
      features: [
        "~4 weeks of activities",
        "Reusable materials pool",
        "Weekly themes",
        "Gentle progression",
        "Monthly overview",
        "Regenerate by day or week",
      ],
      highlight: true,
    },
  ];


  return (
    <section
      id="pricing"
      aria-labelledby="pricing-heading"
      className="section"
      style={{ background: "white" }}
    >
      <div className="container">
        <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
          <h2 id="pricing-heading" className="section-title">
            Simple pricing
          </h2>
          <p className="section-subtitle" style={{ margin: "0.75rem auto 0" }}>
            Preview your plan first. Download when you're happy.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "1.25rem",
            maxWidth: "960px",
            margin: "0 auto",
          }}
        >
          {products
            .filter((p) => PLANNER_PRODUCTS[p.key].enabled)
            .map((product) => {
            const config = PLANNER_PRODUCTS[product.key];
            return (
              <div
                key={product.key}
                className="card"
                style={{
                  padding: "1.75rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.25rem",
                  outline: product.highlight ? "2px solid var(--color-sage-400)" : undefined,
                  position: "relative",
                }}
              >
                {product.highlight && (
                  <div
                    style={{
                      position: "absolute",
                      top: "-1px",
                      left: "50%",
                      transform: "translateX(-50%) translateY(-50%)",
                      background: "var(--color-sage-500)",
                      color: "white",
                      padding: "0.25rem 0.875rem",
                      borderRadius: "var(--radius-full)",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      fontFamily: "'Outfit', sans-serif",
                      letterSpacing: "0.05em",
                      whiteSpace: "nowrap",
                    }}
                  >
                    POPULAR
                  </div>
                )}

                <div>
                  <span aria-hidden="true" style={{ fontSize: "2rem", display: "block", marginBottom: "0.75rem" }}>
                    {product.icon}
                  </span>
                  <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.25rem", fontWeight: 700 }}>
                    {config.name}
                  </h3>
                  <p style={{ fontSize: "0.875rem", color: "var(--color-stone-500)", marginTop: "0.375rem" }}>
                    {config.description}
                  </p>
                </div>

                <div>
                  <p
                    style={{
                      fontSize: "1.75rem",
                      fontWeight: 800,
                      fontFamily: "'Outfit', sans-serif",
                      color: config.priceInPence === null ? "var(--color-sage-500)" : "var(--color-stone-900)",
                    }}
                  >
                    {formatPrice(config)}
                  </p>
                </div>

                <ul style={{ display: "flex", flexDirection: "column", gap: "0.5rem", listStyle: "none", flex: 1 }}>
                  {product.features.map((feature) => (
                    <li
                      key={feature}
                      style={{ display: "flex", gap: "0.5rem", fontSize: "0.875rem", color: "var(--color-stone-600)" }}
                    >
                      <span aria-hidden="true" style={{ color: "var(--color-sage-500)", flexShrink: 0 }}>✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/planner"
                  className={`btn ${product.highlight ? "btn-primary" : "btn-secondary"}`}
                  style={{ textAlign: "center" }}
                  id={`pricing-cta-${product.key}`}
                >
                  Start free preview
                </Link>
              </div>
            );
          })}
        </div>

        <p
          style={{
            textAlign: "center",
            marginTop: "2rem",
            fontSize: "0.875rem",
            color: "var(--color-stone-400)",
          }}
        >
          Preview is always free. No credit card needed to see your first day.
        </p>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer
      role="contentinfo"
      style={{
        background: "var(--color-stone-900)",
        color: "var(--color-stone-400)",
        padding: "3rem 0",
      }}
    >
      <div
        className="container"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "1.5rem" }}>
          <div>
            <p
              style={{
                fontFamily: "'Outfit', sans-serif",
                fontWeight: 800,
                fontSize: "1.25rem",
                color: "white",
                letterSpacing: "-0.02em",
                marginBottom: "0.5rem",
              }}
            >
              🌱 Sprout
            </p>
            <p style={{ fontSize: "0.875rem", maxWidth: "300px", lineHeight: 1.6 }}>
              Evidence-grounded, screen-free activity planning for families.
            </p>
          </div>

          <nav aria-label="Footer navigation">
            <ul style={{ listStyle: "none", display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
              {[
                { href: "/planner", label: "Build my plan" },
                { href: "#how-it-works", label: "How it works" },
                { href: "#pricing", label: "Pricing" },
                { href: "#evidence", label: "Evidence" },
                { href: "#privacy", label: "Privacy" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    style={{
                      color: "var(--color-stone-400)",
                      textDecoration: "none",
                      fontSize: "0.875rem",
                      transition: "color var(--transition-fast)",
                    }}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.08)",
            paddingTop: "1.5rem",
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <p style={{ fontSize: "0.8125rem" }}>
            Sprout is an activity-planning tool, not medical, psychological, diagnostic, therapeutic, or professional childcare advice.
          </p>
          <p style={{ fontSize: "0.8125rem" }}>
            © {new Date().getFullYear()} Sprout Planner
          </p>
        </div>
      </div>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function HomePage() {
  return (
    <>
      <Nav />
      <main id="main-content">
        <Hero />
        <HowItWorks />
        <WhyParents />
        <EvidenceSection />
        <PrivacySection />
        <ExamplePreview />
        <Pricing />
      </main>
      <Footer />
    </>
  );
}
