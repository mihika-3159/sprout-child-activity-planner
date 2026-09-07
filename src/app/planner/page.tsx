"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AGE_BANDS,
  INTERESTS,
  GOALS,
  ENVIRONMENTS,
  DURATIONS,
  PARENT_INVOLVEMENTS,
  PREP_TOLERANCES,
  MATERIALS,
  ENERGY_LEVELS,
  PLANNER_PRODUCTS,
  INTEREST_LABELS,
  GOAL_LABELS,
  ENVIRONMENT_LABELS,
  DURATION_LABELS,
  INVOLVEMENT_LABELS,
  PREP_LABELS,
  MATERIAL_LABELS,
  ENERGY_LABELS,
  AgeBand,
  Interest,
  Goal,
  Environment,
  Duration,
  ParentInvolvement,
  PrepTolerance,
  Material,
  EnergyLevel,
  PlannerProduct,
  PlannerPreferences,
} from "@/lib/schemas/preferences";
import { PRIVACY_NOTICE, redactIdentifyingInformation, getPrivacyReminderMessage } from "@/lib/privacy/redaction";

interface ChatMessage {
  id: string;
  sender: "assistant" | "user";
  text: string;
  options?: {
    type: "single" | "multi";
    field: keyof PlannerPreferences | "childAge";
    items: Array<{ value: string; label: string }>;
  };
}

export default function PlannerChatPage() {
  const router = useRouter();
  const [step, setStep] = useState<number>(1);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [privacyWarning, setPrivacyWarning] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Preference state
  const [ageBand, setAgeBand] = useState<AgeBand>("4-5");
  const [selectedInterests, setSelectedInterests] = useState<Interest[]>(["animals", "art"]);
  const [customInterestInput, setCustomInterestInput] = useState<string>("");
  const [customInterests, setCustomInterests] = useState<string[]>([]);
  const [selectedGoals, setSelectedGoals] = useState<Goal[]>(["independent_play", "creativity"]);
  const [environment, setEnvironment] = useState<Environment>("indoors");
  const [duration, setDuration] = useState<Duration>("20-30");
  const [parentInvolvement, setParentInvolvement] = useState<ParentInvolvement>("setup_then_independent");
  const [prepTolerance, setPrepTolerance] = useState<PrepTolerance>("under_5_min");
  const [selectedMaterials, setSelectedMaterials] = useState<Material[]>([
    "paper",
    "pencils_crayons",
    "cardboard",
    "tape",
  ]);
  const [householdOnly, setHouseholdOnly] = useState<boolean>(true);
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel>("moderate");
  const [productType, setProductType] = useState<PlannerProduct>("weekly");

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [step, isGenerating]);

  // Handle custom interest addition with live privacy redaction
  const handleAddCustomInterest = () => {
    if (!customInterestInput.trim()) return;
    const redaction = redactIdentifyingInformation(customInterestInput);
    if (redaction.wasModified) {
      setPrivacyWarning(getPrivacyReminderMessage(redaction.detectedTypes));
    } else {
      setPrivacyWarning(null);
    }
    const cleanText = redaction.redacted.trim().slice(0, 40);
    if (cleanText && !customInterests.includes(cleanText)) {
      setCustomInterests([...customInterests, cleanText]);
    }
    setCustomInterestInput("");
  };

  const handleGeneratePlan = async () => {
    setIsGenerating(true);
    setErrorMessage(null);

    const preferences: PlannerPreferences = {
      child: {
        ageBand,
        numberOfChildren: 1,
        additionalChildAgeBands: [],
      },
      interests: selectedInterests.length > 0 ? selectedInterests : ["art"],
      customInterests,
      goals: selectedGoals.length > 0 ? selectedGoals : ["independent_play"],
      environment,
      duration,
      parentInvolvement,
      prepTolerance,
      materials: selectedMaterials.length > 0 ? selectedMaterials : ["paper", "pencils_crayons"],
      householdMaterialsOnly: householdOnly,
      energyLevel,
      activitiesPerDay: 1,
      productType,
    };

    try {
      const res = await fetch("/api/planner/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate plan");
      }

      // Redirect to preview page
      router.push(`/preview/${data.generationId}`);
    } catch (err: unknown) {
      console.error(err);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "We're temporarily at capacity. Please try again shortly."
      );
      setIsGenerating(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--color-cream)" }}>
      {/* Header */}
      <header
        style={{
          borderBottom: "1px solid var(--color-stone-200)",
          background: "white",
          padding: "1rem 0",
          position: "sticky",
          top: 0,
          zIndex: 40,
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
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", color: "var(--color-stone-500)" }}>
            <span>Step {step} of 6</span>
            <div style={{ display: "flex", gap: "4px" }}>
              {[1, 2, 3, 4, 5, 6].map((s) => (
                <div
                  key={s}
                  className={`progress-dot ${s <= step ? "active" : ""}`}
                  style={{ width: "6px", height: "6px" }}
                />
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Main Chat Assistant Workspace */}
      <main className="container" style={{ flex: 1, padding: "2rem 1.5rem", maxWidth: "800px" }}>
        {/* Privacy Notice Card */}
        <div className="privacy-notice" style={{ marginBottom: "2rem" }}>
          <span aria-hidden="true" style={{ fontSize: "1.25rem", flexShrink: 0 }}>
            🔒
          </span>
          <div>
            <p style={{ fontWeight: 600, fontFamily: "'Outfit', sans-serif", color: "var(--color-amber-600)", marginBottom: "0.25rem" }}>
              Privacy-first planning
            </p>
            <p style={{ lineHeight: 1.5 }}>{PRIVACY_NOTICE}</p>
          </div>
        </div>

        {privacyWarning && (
          <div
            style={{
              background: "var(--color-error-bg)",
              border: "1px solid var(--color-error)",
              borderRadius: "var(--radius-md)",
              padding: "0.875rem 1rem",
              marginBottom: "1.5rem",
              fontSize: "0.875rem",
              color: "var(--color-error)",
            }}
          >
            {privacyWarning}
          </div>
        )}

        {errorMessage && (
          <div
            style={{
              background: "var(--color-error-bg)",
              border: "1px solid var(--color-error)",
              borderRadius: "var(--radius-md)",
              padding: "1rem",
              marginBottom: "1.5rem",
              color: "var(--color-error)",
              fontSize: "0.9375rem",
            }}
          >
            <p style={{ fontWeight: 600, marginBottom: "0.25rem" }}>Notice</p>
            <p>{errorMessage}</p>
            <button
              onClick={() => handleGeneratePlan()}
              className="btn btn-primary btn-sm"
              style={{ marginTop: "0.75rem" }}
            >
              Retry generation
            </button>
          </div>
        )}

        {/* Conversational Stream */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Step 1: Age Band */}
          <div className="chat-bubble chat-bubble-assistant">
            <p style={{ fontWeight: 600, marginBottom: "0.75rem", color: "var(--color-stone-900)" }}>
              Welcome! Let's build your screen-free activity plan. Which age range is this for?
            </p>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {AGE_BANDS.map((band) => (
                <button
                  key={band}
                  type="button"
                  className={`chip ${ageBand === band ? "selected" : ""}`}
                  onClick={() => {
                    setAgeBand(band);
                    if (step === 1) setStep(2);
                  }}
                  id={`chip-age-${band}`}
                >
                  Age {band}
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Interests */}
          {step >= 2 && (
            <div className="chat-bubble chat-bubble-assistant animate-fade-in">
              <p style={{ fontWeight: 600, marginBottom: "0.75rem", color: "var(--color-stone-900)" }}>
                What does your child enjoy right now? Select as many as you like:
              </p>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
                {INTERESTS.map((int) => {
                  const isSelected = selectedInterests.includes(int);
                  return (
                    <button
                      key={int}
                      type="button"
                      className={`chip ${isSelected ? "selected" : ""}`}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedInterests(selectedInterests.filter((i) => i !== int));
                        } else {
                          setSelectedInterests([...selectedInterests, int]);
                        }
                      }}
                      id={`chip-interest-${int}`}
                    >
                      {INTEREST_LABELS[int]}
                    </button>
                  );
                })}
              </div>

              {/* Custom Non-identifying Interest Input */}
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                  type="text"
                  className="input"
                  placeholder="Add custom interest (e.g. origami, bugs)"
                  value={customInterestInput}
                  onChange={(e) => setCustomInterestInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddCustomInterest())}
                  style={{ maxWidth: "340px", fontSize: "0.875rem", padding: "0.5rem 0.875rem" }}
                  id="custom-interest-input"
                />
                <button
                  type="button"
                  onClick={handleAddCustomInterest}
                  className="btn btn-secondary btn-sm"
                >
                  Add
                </button>
              </div>

              {customInterests.length > 0 && (
                <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
                  {customInterests.map((ci) => (
                    <span
                      key={ci}
                      style={{
                        background: "var(--color-sage-100)",
                        color: "var(--color-sage-700)",
                        padding: "0.25rem 0.625rem",
                        borderRadius: "var(--radius-full)",
                        fontSize: "0.75rem",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.25rem",
                      }}
                    >
                      {ci}
                      <button
                        type="button"
                        onClick={() => setCustomInterests(customInterests.filter((c) => c !== ci))}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-sage-700)" }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {step === 2 && (
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="btn btn-primary btn-sm"
                  style={{ marginTop: "1rem" }}
                  id="btn-next-step-2"
                >
                  Continue →
                </button>
              )}
            </div>
          )}

          {/* Step 3: Goals & Involvement */}
          {step >= 3 && (
            <div className="chat-bubble chat-bubble-assistant animate-fade-in">
              <p style={{ fontWeight: 600, marginBottom: "0.5rem", color: "var(--color-stone-900)" }}>
                What are your main goals for this week?
              </p>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
                {GOALS.map((goal) => {
                  const isSelected = selectedGoals.includes(goal);
                  return (
                    <button
                      key={goal}
                      type="button"
                      className={`chip ${isSelected ? "selected" : ""}`}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedGoals(selectedGoals.filter((g) => g !== goal));
                        } else {
                          setSelectedGoals([...selectedGoals, goal]);
                        }
                      }}
                      id={`chip-goal-${goal}`}
                    >
                      {GOAL_LABELS[goal]}
                    </button>
                  );
                })}
              </div>

              <p style={{ fontWeight: 600, marginBottom: "0.5rem", color: "var(--color-stone-900)" }}>
                How involved do you want to be?
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
                {PARENT_INVOLVEMENTS.map((inv) => (
                  <button
                    key={inv}
                    type="button"
                    className={`chip ${parentInvolvement === inv ? "selected" : ""}`}
                    onClick={() => setParentInvolvement(inv)}
                    style={{ textAlign: "left", justifyContent: "flex-start", padding: "0.625rem 1rem" }}
                    id={`chip-inv-${inv}`}
                  >
                    {INVOLVEMENT_LABELS[inv]}
                  </button>
                ))}
              </div>

              {step === 3 && (
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="btn btn-primary btn-sm"
                  id="btn-next-step-3"
                >
                  Continue →
                </button>
              )}
            </div>
          )}

          {/* Step 4: Environment & Duration */}
          {step >= 4 && (
            <div className="chat-bubble chat-bubble-assistant animate-fade-in">
              <p style={{ fontWeight: 600, marginBottom: "0.5rem", color: "var(--color-stone-900)" }}>
                Where will activities happen?
              </p>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
                {ENVIRONMENTS.map((env) => (
                  <button
                    key={env}
                    type="button"
                    className={`chip ${environment === env ? "selected" : ""}`}
                    onClick={() => setEnvironment(env)}
                    id={`chip-env-${env}`}
                  >
                    {ENVIRONMENT_LABELS[env]}
                  </button>
                ))}
              </div>

              <p style={{ fontWeight: 600, marginBottom: "0.5rem", color: "var(--color-stone-900)" }}>
                How long should each activity typically last?
              </p>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
                {DURATIONS.map((dur) => (
                  <button
                    key={dur}
                    type="button"
                    className={`chip ${duration === dur ? "selected" : ""}`}
                    onClick={() => setDuration(dur)}
                    id={`chip-dur-${dur}`}
                  >
                    {DURATION_LABELS[dur]}
                  </button>
                ))}
              </div>

              {step === 4 && (
                <button
                  type="button"
                  onClick={() => setStep(5)}
                  className="btn btn-primary btn-sm"
                  id="btn-next-step-4"
                >
                  Continue →
                </button>
              )}
            </div>
          )}

          {/* Step 5: Materials */}
          {step >= 5 && (
            <div className="chat-bubble chat-bubble-assistant animate-fade-in">
              <p style={{ fontWeight: 600, marginBottom: "0.5rem", color: "var(--color-stone-900)" }}>
                What materials do you have readily available?
              </p>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
                {MATERIALS.map((mat) => {
                  const isSelected = selectedMaterials.includes(mat);
                  return (
                    <button
                      key={mat}
                      type="button"
                      className={`chip ${isSelected ? "selected" : ""}`}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedMaterials(selectedMaterials.filter((m) => m !== mat));
                        } else {
                          setSelectedMaterials([...selectedMaterials, mat]);
                        }
                      }}
                      id={`chip-mat-${mat}`}
                    >
                      {MATERIAL_LABELS[mat]}
                    </button>
                  );
                })}
              </div>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontSize: "0.875rem",
                  color: "var(--color-stone-700)",
                  cursor: "pointer",
                  marginBottom: "1rem",
                }}
              >
                <input
                  type="checkbox"
                  checked={householdOnly}
                  onChange={(e) => setHouseholdOnly(e.target.checked)}
                  id="checkbox-household-only"
                />
                Use only things most homes already have (no special purchases)
              </label>

              {step === 5 && (
                <button
                  type="button"
                  onClick={() => setStep(6)}
                  className="btn btn-primary btn-sm"
                  id="btn-next-step-5"
                >
                  Review & Generate →
                </button>
              )}
            </div>
          )}

          {/* Step 6: Plan Type & Final Generation */}
          {step >= 6 && (
            <div className="chat-bubble chat-bubble-assistant animate-fade-in" style={{ border: "2px solid var(--color-sage-300)" }}>
              <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.125rem", fontWeight: 700, color: "var(--color-stone-900)", marginBottom: "0.5rem" }}>
                Ready to generate your personalised activity plan!
              </p>
              <p style={{ fontSize: "0.9375rem", color: "var(--color-stone-600)", marginBottom: "1.25rem" }}>
                We'll retrieve vetted child development research, ground each activity in proven evidence, and assemble your plan.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1.5rem" }}>
                <button
                  type="button"
                  className={`card ${productType === "weekly" ? "selected" : ""}`}
                  style={{
                    padding: "1rem",
                    textAlign: "left",
                    cursor: "pointer",
                    border: productType === "weekly" ? "2px solid var(--color-sage-500)" : "1px solid var(--color-stone-200)",
                    background: productType === "weekly" ? "var(--color-sage-50)" : "white",
                  }}
                  onClick={() => setProductType("weekly")}
                  id="btn-select-weekly"
                >
                  <p style={{ fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>📅 7-Day Weekly Plan</p>
                  <p style={{ fontSize: "0.8125rem", color: "var(--color-stone-500)", marginTop: "0.25rem" }}>
                    Balanced 7-day curriculum
                  </p>
                </button>

                <button
                  type="button"
                  className={`card ${productType === "monthly" ? "selected" : ""}`}
                  style={{
                    padding: "1rem",
                    textAlign: "left",
                    cursor: "pointer",
                    border: productType === "monthly" ? "2px solid var(--color-sage-500)" : "1px solid var(--color-stone-200)",
                    background: productType === "monthly" ? "var(--color-sage-50)" : "white",
                  }}
                  onClick={() => setProductType("monthly")}
                  id="btn-select-monthly"
                >
                  <p style={{ fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>📆 4-Week Monthly Plan</p>
                  <p style={{ fontSize: "0.8125rem", color: "var(--color-stone-500)", marginTop: "0.25rem" }}>
                    Weekly themes & progression
                  </p>
                </button>
              </div>

              <button
                type="button"
                disabled={isGenerating}
                onClick={handleGeneratePlan}
                className="btn btn-primary btn-lg"
                style={{ width: "100%", justifyContent: "center" }}
                id="btn-generate-plan-final"
              >
                {isGenerating ? (
                  <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span className="animate-pulse">🌱</span> Grounding with evidence & building plan...
                  </span>
                ) : (
                  "Generate My Plan Preview →"
                )}
              </button>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </main>
    </div>
  );
}
