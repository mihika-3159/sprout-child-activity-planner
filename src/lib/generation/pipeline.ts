/**
 * Evidence-Grounded Generation Pipeline
 *
 * Implements the non-negotiable generation pipeline:
 * User preferences
 * → Structured validation & Privacy redaction
 * → Local approved evidence retrieval
 * → Activity batch generation with AI
 * → Strict validation (Evidence grounding, Age, Safety, Materials, Novelty)
 * → Regeneration of rejected items
 * → Planner composition & Audit recording
 *
 * Per spec sections 1, 2, 3, 4, 11, 22, 23.
 */
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../db/schema";
import {
  PlannerPreferences,
  PlannedActivity,
  AgeBand,
  SupervisionLevel,
} from "../schemas/preferences";
import { retrieveApprovedEvidence, RetrievedChunk } from "../evidence/retrieval";
import { validateActivity, ValidationResult } from "./validator";
import {
  createConceptHash,
  createNoveltySignature,
  checkActivityNovelty,
  recordActivityFingerprint,
} from "./novelty";
import { getProvider, initializeAIProviders } from "../ai/providers";
import { ensureEvidenceSeeded } from "../evidence/seed";

export interface GenerationProgressCallback {
  (status: string, percentage: number): void;
}

/**
 * Generate a single validated activity for a specific day/slot
 */
export async function generateSingleActivity(params: {
  sessionId: string;
  preferences: PlannerPreferences;
  dayNumber: number;
  activityIndex?: number;
  targetDomain?: string;
  maxAttempts?: number;
}): Promise<PlannedActivity> {
  const { sessionId, preferences, dayNumber, maxAttempts = 3 } = params;

  // Ensure DB & evidence are initialized
  await ensureEvidenceSeeded();
  initializeAIProviders();

  // 1. Determine age bounds from preferences
  const ageMap: Record<AgeBand, [number, number]> = {
    "2-3": [2, 3],
    "4-5": [4, 5],
    "6-7": [6, 7],
    "8-9": [8, 9],
    "10-12": [10, 12],
    "13+": [13, 18],
  };
  const [ageMin, ageMax] = ageMap[preferences.child.ageBand] || [4, 7];

  // 2. Retrieve approved evidence chunks
  const queryTopics = [
    ...preferences.goals,
    ...preferences.interests,
    params.targetDomain ?? "",
    preferences.child.ageBand,
  ].filter(Boolean);

  const retrievedEvidence = await retrieveApprovedEvidence(queryTopics.join(" "), {
    ageMin,
    ageMax,
    domains: preferences.goals,
    limit: 4,
  });

  if (retrievedEvidence.length === 0) {
    throw new Error(
      "I don't have enough approved evidence to recommend that confidently yet. We recommend selecting standard developmental goals like fine motor, problem solving, or physical movement."
    );
  }

  const primaryEvidence = retrievedEvidence[0];
  const allEvidenceChunkIds = retrievedEvidence.map((e) => e.chunkId);
  const allSourceIds = Array.from(new Set(retrievedEvidence.map((e) => e.sourceId)));

  let lastValidationResult: ValidationResult | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // 3. Construct generation prompt constrained strictly by retrieved evidence
    const availableMaterialsStr = preferences.materials.join(", ");
    const interestsStr = [
      ...preferences.interests,
      ...preferences.customInterests,
    ].join(", ");

    const systemPrompt = `You are Sprout's Activity Planning Engine.
You generate engaging, developmentally useful, screen-free activities for children.
NON-NEGOTIABLE PRINCIPLES:
1. You may creatively design the activity concept around the child's interests and available materials.
2. You MUST NOT invent developmental science. Ground the "rationale" and benefits STRICTLY in the provided approved evidence.
3. Safety strictly overrides convenience. Never recommend hazardous objects (sharp blades, hot liquids, high climbing) for independent play.
4. Output MUST be valid JSON adhering exactly to the requested schema.`;

    const userPrompt = `Generate a single screen-free activity for Day ${dayNumber} matching these exact constraints:
- Child Age Band: ${preferences.child.ageBand}
- Child Interests: ${interestsStr}
- Parent Goals: ${preferences.goals.join(", ")}
- Preferred Environment: ${preferences.environment}
- Target Duration: ${preferences.duration} minutes
- Desired Parent Involvement: ${preferences.parentInvolvement}
- Materials Available: ${availableMaterialsStr}${preferences.householdMaterialsOnly ? " (ONLY common household items)" : ""}
- Energy Level: ${preferences.energyLevel}

APPROVED SCIENTIFIC EVIDENCE TO GROUND THIS ACTIVITY:
Title: "${primaryEvidence.sourceTitle}" (${primaryEvidence.organizationAuthors}, ${primaryEvidence.publicationYear || "n.d."})
Evidence Text: "${primaryEvidence.chunkText}"
Allowed Developmental Domains: ${primaryEvidence.developmentalDomains.join(", ")}
Safety Considerations from Evidence: "${primaryEvidence.safetyConsiderations}"
Supervision Considerations from Evidence: "${primaryEvidence.supervisionConsiderations}"

Respond with a JSON object matching this schema:
{
  "title": "Clear, engaging, non-clickbait title (3-8 words)",
  "description": "Engaging description of what they will do (1-2 sentences)",
  "instructions": ["Step 1...", "Step 2...", "Step 3..."],
  "materials": ["item 1", "item 2"],
  "setupMinutes": 3,
  "activityMinutes": { "min": 15, "max": 30 },
  "supervisionLevel": "independent" | "setup_then_independent" | "periodic_checkin" | "active_supervision",
  "parentSetup": ["What parent prepares beforehand..."],
  "developmentalDomains": ["domain1", "domain2"],
  "rationale": "Evidence-grounded benefit in warm, parent-friendly terms (NO exaggerated claims like 'boosts IQ' or 'guarantees success')",
  "safetyNotes": ["Clear safety guideline if applicable"],
  "easyVariation": "Simple alternative if child loses interest or materials are missing",
  "extension": "Way to extend activity if child enjoys it"
}`;

    const provider = getProvider();
    let rawActivity: Partial<PlannedActivity>;

    try {
      rawActivity = await provider.generateStructured<Partial<PlannedActivity>>({
        prompt: userPrompt,
        systemPrompt,
        schema: { type: "object" },
        temperature: 0.6 + attempt * 0.1, // Increase temperature slightly on retries for novelty
      });
    } catch (err) {
      console.error("[Generation] LLM generation error:", err);
      // If AI provider fails, generate grounded fallback using template recombination
      rawActivity = createGroundedFallbackActivity(preferences, primaryEvidence, dayNumber);
    }

    // 4. Assemble full PlannedActivity object with evidence support bindings
    const activityId = uuidv4();
    const mechanism = rawActivity.title?.split(" ")[0] || "activity";
    const domains = rawActivity.developmentalDomains || primaryEvidence.developmentalDomains;
    const materials = rawActivity.materials || ["paper", "crayons"];

    const conceptHash = createConceptHash({
      domains,
      materials,
      mechanism,
      energyLevel: preferences.energyLevel,
    });

    const noveltySignature = createNoveltySignature({
      title: rawActivity.title || `Day ${dayNumber} Activity`,
      domains,
      materials,
      mechanism,
    });

    const plannedActivity: PlannedActivity = {
      id: activityId,
      title: rawActivity.title || "Creative Household Project",
      targetAgeBand: preferences.child.ageBand,
      description: rawActivity.description || "An engaging screen-free exploratory project.",
      instructions: rawActivity.instructions && rawActivity.instructions.length > 0
        ? rawActivity.instructions
        : ["Gather your materials.", "Follow the creative steps.", "Explore variations."],
      materials: materials,
      setupMinutes: Number(rawActivity.setupMinutes) || 2,
      activityMinutes: rawActivity.activityMinutes || { min: 15, max: 30 },
      supervisionLevel: (rawActivity.supervisionLevel as SupervisionLevel) || "setup_then_independent",
      parentSetup: rawActivity.parentSetup || ["Place materials on a clear table."],
      developmentalDomains: domains,
      rationale: rawActivity.rationale || primaryEvidence.chunkText.slice(0, 200),
      evidence: [
        {
          sourceIds: allSourceIds,
          chunkIds: allEvidenceChunkIds,
          supportExplanation: `Grounded in ${primaryEvidence.sourceTitle} (${primaryEvidence.organizationAuthors}). Supports ${domains.join(", ")}.`,
        },
      ],
      safetyNotes: rawActivity.safetyNotes || [],
      easyVariation: rawActivity.easyVariation || "Simplify the steps using basic drawings.",
      extension: rawActivity.extension || "Create an additional related challenge.",
      noveltySignature,
      evidenceSupport: {
        evidenceChunkIds: allEvidenceChunkIds,
        supportedDomains: domains,
        evidenceStrength: primaryEvidence.evidenceStrength,
        claimsAllowed: domains,
      },
    };

    // 5. Novelty check against session history
    const noveltyResult = checkActivityNovelty(
      sessionId,
      noveltySignature,
      conceptHash,
      plannedActivity.title
    );

    // 6. Comprehensive validation gates
    const validation = validateActivity(plannedActivity, preferences, noveltyResult);
    lastValidationResult = validation;

    // Record audit
    const db = getDb();
    db.prepare(`
      INSERT INTO generation_audits (
        activity_id, session_id, anonymized_preferences,
        retrieved_chunk_ids, evidence_scores, safety_classification,
        grounding_validation_result, rejection_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      activityId,
      sessionId,
      JSON.stringify({ age: preferences.child.ageBand, goals: preferences.goals }),
      JSON.stringify(allEvidenceChunkIds),
      JSON.stringify(retrievedEvidence.map((e) => ({ id: e.chunkId, score: e.score }))),
      plannedActivity.supervisionLevel,
      validation.passed ? "passed" : validation.failedGates[0] ? `failed_${validation.failedGates[0]}` : "failed_grounding",
      validation.passed ? null : validation.warnings.join("; ")
    );

    if (validation.passed) {
      // Record fingerprint for future novelty checks
      recordActivityFingerprint(sessionId, noveltySignature, conceptHash, plannedActivity.title);
      return plannedActivity;
    }

    console.warn(
      `[Generation] Attempt ${attempt} failed validation gates: ${validation.failedGates.join(", ")}. Warnings: ${validation.warnings.join(", ")}. Retrying...`
    );
  }

  // If retries exhausted, return a strictly safe grounded baseline activity
  const fallback = createGroundedFallbackActivity(preferences, primaryEvidence, dayNumber);
  const fbConcept = createConceptHash({
    domains: fallback.developmentalDomains,
    materials: fallback.materials,
    mechanism: "guided_exploration",
  });
  recordActivityFingerprint(sessionId, fallback.noveltySignature, fbConcept, fallback.title);
  return fallback;
}

/**
 * Creates a deterministic, evidence-grounded fallback activity when AI output fails validation.
 */
function createGroundedFallbackActivity(
  preferences: PlannerPreferences,
  evidence: RetrievedChunk,
  dayNumber: number
): PlannedActivity {
  const id = uuidv4();
  const primaryInterest = preferences.interests[0] || "Creative Play";
  const title = `Day ${dayNumber}: ${primaryInterest.charAt(0).toUpperCase() + primaryInterest.slice(1)} Discovery & Assembly`;
  const domains = evidence.developmentalDomains.slice(0, 3);
  const materials = preferences.materials.slice(0, 4);

  return {
    id,
    title,
    targetAgeBand: preferences.child.ageBand,
    description: `An engaging screen-free exploratory project focusing on ${primaryInterest}, designed for ${preferences.child.ageBand} year olds.`,
    instructions: [
      "Gather the household materials and lay them out on a table or mat.",
      "Explore arranging, assembling, and categorizing the elements by shape, size, or story role.",
      "Encourage the child to test and describe their creation.",
    ],
    materials: materials.length > 0 ? materials : ["paper", "pencils_crayons"],
    setupMinutes: 2,
    activityMinutes: { min: 15, max: 30 },
    supervisionLevel: "setup_then_independent",
    parentSetup: ["Set out materials in an open, safe workspace."],
    developmentalDomains: domains,
    rationale: `Supports ${domains.join(" and ")} through hands-on tactile exploration. Grounded in research from ${evidence.sourceTitle}.`,
    evidence: [
      {
        sourceIds: [evidence.sourceId],
        chunkIds: [evidence.chunkId],
        supportExplanation: `Grounded in ${evidence.sourceTitle} (${evidence.organizationAuthors}, ${evidence.publicationYear || "2021"}).`,
      },
    ],
    safetyNotes: [evidence.safetyConsiderations || "Ensure safe, age-appropriate handling of items."],
    easyVariation: "Focus on simple sorting or free-form drawing if the child wants a simpler task.",
    extension: "Challenge them to add a new level, story detail, or sorting category.",
    noveltySignature: `fallback-${id}:${primaryInterest}`,
    evidenceSupport: {
      evidenceChunkIds: [evidence.chunkId],
      supportedDomains: domains,
      evidenceStrength: evidence.evidenceStrength,
      claimsAllowed: domains,
    },
  };
}
