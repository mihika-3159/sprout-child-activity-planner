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
  normalizePlannerPreferences,
} from "@/lib/schemas/preferences";
import { PRIVACY_NOTICE, redactIdentifyingInformation, getPrivacyReminderMessage } from "@/lib/privacy/redaction";
import { savePlanner } from "@/lib/planner/clientStorage";

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
  const [monthlyProgress, setMonthlyProgress] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const generatingRef = useRef<boolean>(false);

  // Preference state
  const [ageBand, setAgeBand] = useState<AgeBand>("4-5");
  const [selectedInterests, setSelectedInterests] = useState<Interest[]>([]);
  const [customInterestInput, setCustomInterestInput] = useState<string>("");
  const [customInterests, setCustomInterests] = useState<string[]>([]);
  const [selectedGoals, setSelectedGoals] = useState<Goal[]>([]);
  const [environment, setEnvironment] = useState<Environment>("indoors");
  const [duration, setDuration] = useState<Duration>("20-30");
  const [parentInvolvement, setParentInvolvement] = useState<ParentInvolvement>("setup_then_independent");
  const [prepTolerance, setPrepTolerance] = useState<PrepTolerance>("under_5_min");
  const [selectedMaterials, setSelectedMaterials] = useState<Material[]>([]);
  const [householdOnly, setHouseholdOnly] = useState<boolean>(true);
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel>("moderate");
  const [productType, setProductType] = useState<PlannerProduct>("weekly");
  const [playmatesCount, setPlaymatesCount] = useState<number>(0);

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
    // Prevent duplicate submissions
    if (generatingRef.current) return;
    generatingRef.current = true;
    setIsGenerating(true);
    setErrorMessage(null);
    setMonthlyProgress(null);

    // AbortController for timeout / cancel
    const abort = new AbortController();
    abortRef.current = abort;
    const timeoutId = setTimeout(() => abort.abort(), 120_000); // 2-minute hard client timeout

    const preferences: PlannerPreferences = normalizePlannerPreferences({
      child: {
        ageBand,
        numberOfChildren: 1,
        additionalChildAgeBands: [],
      },
      interests: selectedInterests,
      customInterests,
      goals: selectedGoals,
      environment,
      duration,
      parentInvolvement,
      prepTolerance,
      materials: selectedMaterials,
      householdMaterialsOnly: householdOnly,
      energyLevel,
      activitiesPerDay: 1,
      productType,
      playmatesCount,
    });

    try {
      const res = await fetch("/api/planner/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
        signal: abort.signal,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate plan");
      }

      // Monthly: chunked week-by-week generation with visible progress
      if (data.chunked && data.generationId) {
        const generationId: string = data.generationId;
        const totalWeeks: number = data.totalWeeks ?? 4;
        const generationToken: string | undefined = data.generationToken;
        const weeks: any[] = [];
        const existingTitles: string[] = [];
        const existingMechanics: string[] = [];

        for (let week = 1; week <= totalWeeks; week++) {
          if (abort.signal.aborted) throw new Error("Generation was cancelled.");
          setMonthlyProgress(`Creating week ${week} of ${totalWeeks}…`);

          let weekRes: Response | null = null;
          let weekData: any = null;
          let lastErr: Error | null = null;

          for (let attempt = 1; attempt <= 2; attempt++) {
            try {
              weekRes = await fetch(`/api/planner/${generationId}/week`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  ...(generationToken ? { "X-Generation-Token": generationToken } : {}),
                },
                body: JSON.stringify({ weekNumber: week, preferences, existingTitles, existingMechanics }),
                signal: abort.signal,
              });
              weekData = await weekRes.json();
              if (weekRes.ok) break;
            } catch (fetchErr) {
              lastErr = fetchErr instanceof Error ? fetchErr : new Error("Network request failed");
            }
          }

          if (!weekRes || !weekRes.ok) {
            throw new Error((weekData && weekData.error) || (lastErr && lastErr.message) || `Failed generating week ${week}`);
          }
          weeks.push(weekData.week);
          for (const day of weekData.week.days) for (const activity of day.activities) {
            existingTitles.push(activity.title);
            if (activity.noveltySignature) existingMechanics.push(activity.noveltySignature);
          }
        }

        setMonthlyProgress("Finalising your monthly plan…");
        clearTimeout(timeoutId);
        if (generationToken) {
          try { sessionStorage.setItem(`sprout_token_${generationId}`, generationToken); } catch {}
        }
        const allMaterials = Array.from(
          new Set<string>(weeks.flatMap((w) => w.days.flatMap((d: any) => d.activities.flatMap((a: any) => a.materials as string[]))))
        );
        const monthlyPlanner = {
          id: generationId,
          sessionId: generationId,
          preferences,
          generatedAt: new Date().toISOString(),
          monthlyOverview: {
            activityMix: "A varied month of hands-on activities matched to your selections.",
            materialsToKeepNearby: allMaterials.slice(0, 8),
            estimatedParentPrepPerWeek: "About 10 minutes of advance setup.",
            optionalWeeklyThemes: weeks.map((w) => w.theme),
            numberOfLowSupervisionActivities: weeks.flatMap((w) => w.days).filter((d: any) => d.activities[0].supervisionLevel !== "active_supervision").length,
          },
          prepThisMonth: `Keep these materials together where practical: ${allMaterials.slice(0, 8).join(", ")}. Check each activity's supervision and safety notes before starting.`,
          weeks,
          globalMaterialsPool: allMaterials,
        };
        savePlanner(generationId, { planner: monthlyPlanner, productType: "monthly", generationToken, savedAt: new Date().toISOString() });
        router.push(`/planner/${generationId}${generationToken ? `?token=${encodeURIComponent(generationToken)}` : ""}`);
        return;
      }

      // Weekly: direct redirect
      clearTimeout(timeoutId);
      const weeklyToken: string | undefined = data.generationToken;
      if (weeklyToken) {
        try { sessionStorage.setItem(`sprout_token_${data.generationId}`, weeklyToken); } catch {}
      }
      if (data.planner) savePlanner(data.generationId, { planner: data.planner, productType: "weekly", generationToken: weeklyToken, savedAt: new Date().toISOString() });
      router.push(`/planner/${data.generationId}${weeklyToken ? `?token=${encodeURIComponent(weeklyToken)}` : ""}`);
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const isAbort = err instanceof Error && err.name === "AbortError";
      console.error(err);
      setErrorMessage(
        isAbort
          ? "Generation timed out. Please try again."
          : err instanceof Error
          ? err.message
          : "We're temporarily at capacity. Please try again shortly."
      );
      setMonthlyProgress(null);
      setIsGenerating(false);
      generatingRef.current = false;
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
            <span>Step {step} of 7</span>
            <div style={{ display: "flex", gap: "4px" }}>
              {[1, 2, 3, 4, 5, 6, 7].map((s) => (
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

        {/* Accessible live status */}
        <div role="status" aria-live="polite" className="sr-only">
          Step {step} of 7: {step === 1 ? "Choose child's age" : step === 2 ? "Select interests" : step === 3 ? "Set goals and involvement" : step === 4 ? "Select playmates" : step === 5 ? "Choose environment and duration" : step === 6 ? "Select available materials" : "Review and generate plan"}
        </div>

        {/* Conversational Stream */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Step 1: Age Band */}
          <div className="chat-bubble chat-bubble-assistant">
            <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
              <legend style={{ fontWeight: 600, marginBottom: "0.75rem", color: "var(--color-stone-900)", display: "block" }}>
                Welcome! Let&apos;s build your screen-free activity plan. Which age range is this for?
              </legend>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {AGE_BANDS.map((band) => (
                  <button
                    key={band}
                    type="button"
                    className={`chip ${ageBand === band ? "selected" : ""}`}
                    aria-pressed={ageBand === band}
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
            </fieldset>
          </div>

          {/* Step 2: Interests */}
          {step >= 2 && (
            <div className="chat-bubble chat-bubble-assistant animate-fade-in">
              <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
                <legend style={{ fontWeight: 600, marginBottom: "0.25rem", color: "var(--color-stone-900)", display: "block" }}>
                  What does your child enjoy right now?
                </legend>
                <span style={{ display: "block", fontSize: "0.8125rem", color: "var(--color-stone-500)", fontWeight: 400, marginBottom: "0.75rem" }}>
                  Optional — select any that apply, or add your own
                </span>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
                  {INTERESTS.map((int) => {
                    const isSelected = selectedInterests.includes(int);
                    return (
                      <button
                        key={int}
                        type="button"
                        className={`chip ${isSelected ? "selected" : ""}`}
                        aria-pressed={isSelected}
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
              </fieldset>

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
                  aria-label="Add custom interest"
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
                        aria-label={`Remove ${ci}`}
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
              {ageBand === "2-3" && (
                <div
                  style={{
                    background: "var(--color-cream)",
                    borderLeft: "3.5px solid var(--color-sage-600)",
                    padding: "0.75rem 1rem",
                    borderRadius: "var(--radius-sm)",
                    marginBottom: "1.25rem",
                    fontSize: "0.8125rem",
                    color: "var(--color-stone-700)",
                  }}
                >
                  <strong style={{ color: "var(--color-sage-800)" }}>💡 Toddler note:</strong> For ages 2–3, toddlers develop through sensory discovery and close connection. Even with low-prep activities, active adult presence is recommended for safety and shared delight.
                </div>
              )}

              <fieldset style={{ border: "none", padding: 0, margin: "0 0 1.25rem 0" }}>
                <legend style={{ fontWeight: 600, marginBottom: "0.25rem", color: "var(--color-stone-900)", display: "block" }}>
                  What are your main goals for this week?
                </legend>
                <span style={{ display: "block", fontSize: "0.8125rem", color: "var(--color-stone-500)", fontWeight: 400, marginBottom: "0.75rem" }}>
                  Optional — select any that apply
                </span>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {GOALS.map((goal) => {
                    const isSelected = selectedGoals.includes(goal);
                    return (
                      <button
                        key={goal}
                        type="button"
                        className={`chip ${isSelected ? "selected" : ""}`}
                        aria-pressed={isSelected}
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
              </fieldset>

              <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
                <legend style={{ fontWeight: 600, marginBottom: "0.5rem", color: "var(--color-stone-900)", display: "block" }}>
                  How involved do you want to be?
                </legend>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
                  {PARENT_INVOLVEMENTS.map((inv) => (
                    <button
                      key={inv}
                      type="button"
                      className={`chip ${parentInvolvement === inv ? "selected" : ""}`}
                      aria-pressed={parentInvolvement === inv}
                      onClick={() => setParentInvolvement(inv)}
                      style={{ textAlign: "left", justifyContent: "flex-start", padding: "0.625rem 1rem" }}
                      id={`chip-inv-${inv}`}
                    >
                      {INVOLVEMENT_LABELS[inv]}
                    </button>
                  ))}
                </div>
              </fieldset>

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

          {/* Step 4: Playmates */}
          {step >= 4 && (
            <div className="chat-bubble chat-bubble-assistant animate-fade-in">
              <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
                <legend style={{ fontWeight: 600, marginBottom: "0.75rem", color: "var(--color-stone-900)", display: "block" }}>
                  Are there other children your child can play with? This helps us plan activities that work for solo or group play.
                </legend>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
                  {[
                    { value: 0, label: "🧒 No — my child will be playing alone" },
                    { value: 1, label: "👫 Yes — 1 other child to play with" },
                    { value: 2, label: "👨‍👩‍👧 Yes — 2 or more others available" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`chip ${playmatesCount === opt.value ? "selected" : ""}`}
                      aria-pressed={playmatesCount === opt.value}
                      onClick={() => setPlaymatesCount(opt.value)}
                      style={{ textAlign: "left", justifyContent: "flex-start", padding: "0.625rem 1rem" }}
                      id={`chip-playmates-${opt.value}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </fieldset>
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

          {/* Step 5: Environment & Duration */}
          {step >= 5 && (
            <div className="chat-bubble chat-bubble-assistant animate-fade-in">
              <fieldset style={{ border: "none", padding: 0, margin: "0 0 1rem 0" }}>
                <legend style={{ fontWeight: 600, marginBottom: "0.5rem", color: "var(--color-stone-900)", display: "block" }}>
                  Where will activities happen?
                </legend>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {ENVIRONMENTS.map((env) => (
                    <button
                      key={env}
                      type="button"
                      className={`chip ${environment === env ? "selected" : ""}`}
                      aria-pressed={environment === env}
                      onClick={() => setEnvironment(env)}
                      id={`chip-env-${env}`}
                    >
                      {ENVIRONMENT_LABELS[env]}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset style={{ border: "none", padding: 0, margin: "0 0 1rem 0" }}>
                <legend style={{ fontWeight: 600, marginBottom: "0.5rem", color: "var(--color-stone-900)", display: "block" }}>
                  How long should each activity typically last?
                </legend>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {DURATIONS.map((dur) => (
                    <button
                      key={dur}
                      type="button"
                      className={`chip ${duration === dur ? "selected" : ""}`}
                      aria-pressed={duration === dur}
                      onClick={() => setDuration(dur)}
                      id={`chip-dur-${dur}`}
                    >
                      {DURATION_LABELS[dur]}
                    </button>
                  ))}
                </div>
              </fieldset>

              {step === 5 && (
                <button
                  type="button"
                  onClick={() => setStep(6)}
                  className="btn btn-primary btn-sm"
                  id="btn-next-step-5"
                >
                  Continue →
                </button>
              )}
            </div>
          )}

          {/* Step 6: Materials */}
          {step >= 6 && (
            <div className="chat-bubble chat-bubble-assistant animate-fade-in">
              <fieldset style={{ border: "none", padding: 0, margin: "0 0 1rem 0" }}>
                <legend style={{ fontWeight: 600, marginBottom: "0.25rem", color: "var(--color-stone-900)", display: "block" }}>
                  What materials do you have readily available?
                </legend>
                <span style={{ display: "block", fontSize: "0.8125rem", color: "var(--color-stone-500)", fontWeight: 400, marginBottom: "0.75rem" }}>
                  Optional — select any that apply. Common household basics are used by default
                </span>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {MATERIALS.map((mat) => {
                    const isSelected = selectedMaterials.includes(mat);
                    return (
                      <button
                        key={mat}
                        type="button"
                        className={`chip ${isSelected ? "selected" : ""}`}
                        aria-pressed={isSelected}
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
              </fieldset>

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

              {step === 6 && (
                <button
                  type="button"
                  onClick={() => setStep(7)}
                  className="btn btn-primary btn-sm"
                  id="btn-next-step-6"
                >
                  Review & Generate →
                </button>
              )}
            </div>
          )}

          {/* Step 7: Plan Type & Final Generation */}
          {step >= 7 && (
            <div className="chat-bubble chat-bubble-assistant animate-fade-in" style={{ border: "2px solid var(--color-sage-300)" }}>
              <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.125rem", fontWeight: 700, color: "var(--color-stone-900)", marginBottom: "0.5rem" }}>
                Ready to generate your personalised activity plan!
              </p>
              <p style={{ fontSize: "0.9375rem", color: "var(--color-stone-600)", marginBottom: "1.25rem" }}>
                We&apos;ll match relevant child development research, ground each activity in practical developmental principles, and assemble your plan.
              </p>

              {/* Review Summary Card */}
              <div
                style={{
                  background: "var(--color-cream)",
                  border: "1px solid var(--color-stone-300)",
                  borderRadius: "var(--radius-md)",
                  padding: "1rem 1.25rem",
                  marginBottom: "1.5rem",
                }}
              >
                <h4 style={{ margin: "0 0 0.75rem", fontFamily: "'Outfit', sans-serif", fontSize: "0.9375rem", fontWeight: 700, color: "var(--color-stone-900)" }}>
                  📋 Your Plan Summary
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.8125rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span><strong>Age:</strong> Age {ageBand}</span>
                    <button type="button" onClick={() => setStep(1)} style={{ color: "var(--color-sage-700)", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem" }}>Edit</button>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span><strong>Interests:</strong> {[...selectedInterests.map((i) => INTEREST_LABELS[i]), ...customInterests].join(", ") || "General play"}</span>
                    <button type="button" onClick={() => setStep(2)} style={{ color: "var(--color-sage-700)", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem" }}>Edit</button>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span><strong>Goals &amp; Involvement:</strong> {selectedGoals.map((g) => GOAL_LABELS[g]).join(", ")} • {INVOLVEMENT_LABELS[parentInvolvement]}</span>
                    <button type="button" onClick={() => setStep(3)} style={{ color: "var(--color-sage-700)", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem" }}>Edit</button>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span><strong>Environment &amp; Time:</strong> {ENVIRONMENT_LABELS[environment]} • {DURATION_LABELS[duration]}</span>
                    <button type="button" onClick={() => setStep(5)} style={{ color: "var(--color-sage-700)", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem" }}>Edit</button>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span><strong>Materials:</strong> {selectedMaterials.map((m) => MATERIAL_LABELS[m]).join(", ")}{householdOnly ? " (household only)" : ""}</span>
                    <button type="button" onClick={() => setStep(6)} style={{ color: "var(--color-sage-700)", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem" }}>Edit</button>
                  </div>
                </div>
              </div>

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
                    <span className="animate-pulse">🌱</span>{" "}
                    {monthlyProgress ?? "Grounding with evidence & building plan…"}
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
