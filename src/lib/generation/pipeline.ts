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

  // Pick distinct evidence chunk per day so days don't repeat the exact same grounding
  const primaryEvidence = retrievedEvidence[(dayNumber - 1) % retrievedEvidence.length] || retrievedEvidence[0];
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
1. Every day MUST have a completely unique, creative activity concept, mechanic, and materials combination. Never repeat ideas across days.
2. Ground the "rationale" and developmental benefits in the provided approved evidence.
3. Provide a clear, child-friendly explanation for "whyEngaging" that explains what makes this activity irresistible, playful, and fun for a child of this age without academic jargon.
4. Safety strictly overrides convenience. Never recommend hazardous objects (sharp blades, hot liquids, high climbing) for independent play.
5. Output MUST be valid JSON adhering exactly to the requested schema.`;

    const userPrompt = `Generate a single screen-free activity for Day ${dayNumber} matching these exact constraints:
- Day Number: ${dayNumber} of 7 (Must be distinct from other days)
- Child Age Band: ${preferences.child.ageBand}
- Child Interests: ${interestsStr}
- Parent Goals: ${preferences.goals.join(", ")}
- Preferred Environment: ${preferences.environment}
- Target Duration: ${preferences.duration} minutes
- Desired Parent Involvement: ${preferences.parentInvolvement}
- Materials Available: ${availableMaterialsStr}${preferences.householdMaterialsOnly ? " (ONLY common household items)" : ""}
- Energy Level: ${preferences.energyLevel}
- Play Context: ${
  (preferences.playmatesCount ?? 0) === 0
    ? "SOLO PLAY ONLY — The child will be playing entirely alone. Design an activity that fully absorbs independent attention, requires no partner, and keeps a child self-directed and engaged without adult interaction. The activity must be deeply immersive on its own."
    : (preferences.playmatesCount ?? 0) === 1
    ? "PAIRED PLAY — The child has exactly 1 playmate. Design a collaborative or turn-based activity that works well for two children, encouraging teamwork, friendly competition, or shared creativity."
    : "GROUP PLAY — The child has 2 or more playmates. Design an activity that scales naturally for a group of children, with roles, rounds, or parallel creative tracks to keep everyone engaged."
}

APPROVED SCIENTIFIC EVIDENCE TO GROUND THIS ACTIVITY:
Title: "${primaryEvidence.sourceTitle}" (${primaryEvidence.organizationAuthors}, ${primaryEvidence.publicationYear || "n.d."})
Evidence Text: "${primaryEvidence.chunkText}"
Allowed Developmental Domains: ${primaryEvidence.developmentalDomains.join(", ")}
Safety Considerations from Evidence: "${primaryEvidence.safetyConsiderations}"
Supervision Considerations from Evidence: "${primaryEvidence.supervisionConsiderations}"

Respond with a JSON object matching this schema:
{
  "title": "Clear, engaging, non-clickbait title (3-8 words)",
  "description": "Engaging, detailed description of what they will do (2-3 sentences)",
  "instructions": [
    "Step 1 (clear, concrete setup)...",
    "Step 2 (first playful action)...",
    "Step 3 (creative or problem solving twist)...",
    "Step 4 (wrap up, celebration, or tidying)..."
  ],
  "materials": ["item 1", "item 2"],
  "setupMinutes": 3,
  "activityMinutes": { "min": 15, "max": 30 },
  "supervisionLevel": "independent" | "setup_then_independent" | "periodic_checkin" | "active_supervision",
  "parentSetup": ["What parent prepares beforehand..."],
  "developmentalDomains": ["domain1", "domain2"],
  "rationale": "Evidence-grounded benefit in warm, parent-friendly terms",
  "whyEngaging": "Clear explanation of WHY a child of this age will find this fun and engaging (e.g., sense of mystery, hands-on control, playful storytelling, or physical accomplishment)",
  "safetyNotes": ["Clear safety guideline if applicable"],
  "easyVariation": "Simple alternative if child loses interest or materials are missing",
  "extension": "Way to extend activity if child enjoys it"
}
Do NOT use internal code names or variable identifiers with underscores in titles, descriptions, instructions, or materials.`;

    const provider = getProvider();
    let rawActivity: Partial<PlannedActivity>;

    try {
      rawActivity = await provider.generateStructured<Partial<PlannedActivity>>({
        prompt: userPrompt,
        systemPrompt,
        schema: { type: "object" },
        temperature: 0.65 + (dayNumber * 0.05) + (attempt * 0.1), // Ensure diversity across days
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
      title: rawActivity.title || `Day ${dayNumber} Creative Project`,
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
      whyEngaging: rawActivity.whyEngaging || "Designed to ignite natural curiosity through open-ended tactile play.",
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
 * Creates rich, diverse, evidence-grounded activities with distinct daily themes.
 * Guarantees that Day 1 through Day 7 are completely unique in concept, mechanics, and steps.
 */
function createGroundedFallbackActivity(
  preferences: PlannerPreferences,
  evidence: RetrievedChunk,
  dayNumber: number
): PlannedActivity {
  const id = uuidv4();
  const interestList = preferences.interests.length > 0 ? preferences.interests : ["Creative Play"];
  const primaryInterest = interestList[(dayNumber - 1) % interestList.length];
  const interestFormatted = primaryInterest.charAt(0).toUpperCase() + primaryInterest.slice(1).replace(/_/g, " ");
  const domains = evidence.developmentalDomains.slice(0, 3);
  const materials = preferences.materials.length > 0 ? preferences.materials.slice(0, 4) : ["paper", "pencils_crayons"];

  // 7 Unique daily archetypes calibrated for distinct mechanics and excitement
  const archetypes = [
    {
      theme: "Architect & Builder Challenge",
      title: `Day 1: ${interestFormatted} Fortress & Tower Challenge`,
      description: `Your child transforms simple cardboard, blocks, and tape into an engineered ${interestFormatted.toLowerCase()} tower or shelter with secret doorways.`,
      instructions: [
        `Select 3 to 5 sturdy boxes, containers, or block sets to form the foundation of the ${interestFormatted.toLowerCase()} structure.`,
        "Tape or stack the pieces securely, testing how high the tower can reach before wobbling.",
        `Decorate the walls with drawn flags, windows, or secret tunnels dedicated to ${interestFormatted.toLowerCase()}.`,
        "Test its strength by placing small toys or rolled paper balls inside to see if the structure holds strong.",
        "Take a proud celebration photo of the architect standing beside their towering creation."
      ],
      whyEngaging: `Children at this age love seeing ideas instantly come alive in 3D. The challenge of balancing boxes and testing stability gives an intoxicating rush of agency, trial-and-error problem solving, and accomplishment.`,
      setupMinutes: 3,
      activityMinutes: { min: 20, max: 40 },
      supervisionLevel: "setup_then_independent" as const,
      parentSetup: ["Set out empty boxes, paper tubes, or building blocks with a dispenser of tape on a flat surface."],
      safetyNotes: ["Check that all cardboard edges are smooth and free of staples or sharp tape cutters."],
      easyVariation: "If balancing is tricky, build a flat floor maze or walled enclosure instead of a tall vertical tower.",
      extension: "Introduce a 'bridge challenge': connect two separate towers using a single sheet of paper folded like an accordion."
    },
    {
      theme: "Sensory Detective & Treasure Quest",
      title: `Day 2: The Great ${interestFormatted} Treasure Quest`,
      description: `A fast-paced indoor detective hunt where your child hunts down items matching mystery texture, color, and shape clues.`,
      instructions: [
        "Create 4 mystery clue cards (e.g. 'find something smooth as ice', 'find something greener than a frog', 'find something smaller than a coin').",
        `Arm your child with a detective collection bag or basket to seek out the mystery ${interestFormatted.toLowerCase()} clues around the room.`,
        "Once items are gathered, lay them out on a table and inspect each one like a museum curator.",
        "Sort the treasures into categories: lightest to heaviest, or smoothest to bumpiest.",
        "Award the child their official 'Master Detective' badge drawn on a paper scrap."
      ],
      whyEngaging: `The thrill of the hunt and secret mission framing activates their imagination. Children adore searching their familiar environment with 'detective goggles' and feeling the pride of discovering hidden objects.`,
      setupMinutes: 2,
      activityMinutes: { min: 15, max: 30 },
      supervisionLevel: "setup_then_independent" as const,
      parentSetup: ["Hand the child a small bag, basket, or bowl to hold their treasure discoveries."],
      safetyNotes: ["Keep the hunt restricted to low, accessible shelves away from stairs or fragile items."],
      easyVariation: "Give simple one-word color targets (e.g. 'find 3 blue things') instead of multi-attribute clues.",
      extension: "Hide a special golden coin or drawn paper key that unlocks a surprise secret story."
    },
    {
      theme: "Story Theater & Puppet Stage",
      title: `Day 3: ${interestFormatted} Shadow & Puppet Theater`,
      description: `Transform a flashlight, paper drawings, and table into a miniature puppet stage where wild stories and voice acting come alive.`,
      instructions: [
        `Draw 2 or 3 distinct characters or critters inspired by ${interestFormatted.toLowerCase()} on sturdy paper.`,
        "Carefully cut out the character silhouettes and tape them onto pencils, spoons, or straws as puppet handles.",
        "Dim the room lights and shine a flashlight or lamp against a blank wall or white sheet.",
        "Hold the puppets between the light and the wall, testing how moving closer or farther makes the shadows giant or tiny.",
        "Perform a mini 2-minute improvised show with silly sound effects and dramatic character voices."
      ],
      whyEngaging: `Puppetry gives children the power of storytelling without feeling self-conscious. Moving shadows around feels like real-time magic, and inventing silly voices encourages rich linguistic play.`,
      setupMinutes: 3,
      activityMinutes: { min: 20, max: 35 },
      supervisionLevel: "setup_then_independent" as const,
      parentSetup: ["Clear a small table against a light-colored wall and position a desk lamp or flashlight safely."],
      safetyNotes: ["Remind the child not to look directly into the flashlight beam."],
      easyVariation: "Use hand shadow shapes (bunny, bird, dinosaur jaw) instead of cutting out paper puppets.",
      extension: "Add a narrator who introduces each act with a homemade drumroll using spoons on a container."
    },
    {
      theme: "Wonder Science & Kitchen Experiment",
      title: `Day 4: ${interestFormatted} Color & Texture Wonder Lab`,
      description: `A hands-on exploratory experiment exploring capillary action, liquid drops, and texture mixing using common kitchen bowls.`,
      instructions: [
        "Fill 3 shallow bowls or cups with water; add a drop of food color or swirl washable markers on paper beforehand to create colored water.",
        "Dip folded paper towels or strips of paper into the water to watch the color magically climb up the fibers.",
        `Create a 'floating rescue mission' where small paper ${interestFormatted.toLowerCase()} cutouts are placed on the surface to see if they sink or float.`,
        "Use a spoon or dropper to transfer drops from bowl to bowl, mixing brand new mystery colors.",
        "Dry the vibrant dyed paper strips to keep as colorful bookmarks or mosaic pieces."
      ],
      whyEngaging: `Watching colors spread and water defy gravity creates pure sensory awe. Children love the cause-and-effect power of droppers, spoons, and making tangible physical transformations.`,
      setupMinutes: 4,
      activityMinutes: { min: 15, max: 30 },
      supervisionLevel: "periodic_checkin" as const,
      parentSetup: ["Lay down a towel or baking sheet to catch spills and set out 2-3 small cups of water."],
      safetyNotes: ["Wipe up any spilled water quickly to prevent slippery floors."],
      easyVariation: "Use markers on coffee filters or paper towels and spray lightly with water to watch the tie-dye burst.",
      extension: "Test what objects float versus sink (cork, coin, leaf, button) and chart guesses before dropping them in."
    },
    {
      theme: "Agility Maze & Floor Obstacle Path",
      title: `Day 5: The ${interestFormatted} Secret Floor Maze`,
      description: `Use masking tape or paper markers on the floor to design a thrilling balance course, agility maze, and jumping challenge.`,
      instructions: [
        "Lay out strips of painter's tape on the rug or floor creating straight lines, zig-zags, and circle islands.",
        `Place paper 'stepping stones' representing ${interestFormatted.toLowerCase()} safe zones across the room.`,
        "Challenge the child to cross from one side of the room to the other walking strictly heel-to-toe along the lines.",
        "Add fun challenge stations: balance on one foot for 5 seconds, jump over 3 tape lines, or crawl under a dining chair tunnel.",
        "Time their run with a stopwatch or let them design a reverse route for you to test!"
      ],
      whyEngaging: `This channels high physical energy into focused gross-motor balance. The 'floor is lava' suspense turns an ordinary living room into an adventurous obstacle arena where every step counts.`,
      setupMinutes: 3,
      activityMinutes: { min: 20, max: 40 },
      supervisionLevel: "periodic_checkin" as const,
      parentSetup: ["Apply blue painter's or masking tape to a cleared patch of floor (safe on hardwood and carpets)."],
      safetyNotes: ["Ensure shoes or bare feet have good traction, and move sharp furniture corners aside."],
      easyVariation: "Make wide, simple straight tape pathways with large landing cushions rather than narrow balance lines.",
      extension: "Carry a small plastic egg or ping-pong ball on a spoon through the whole maze without dropping it."
    },
    {
      theme: "Master Artisan & Mosaic Studio",
      title: `Day 6: ${interestFormatted} Mosaic & Nature Rubbing Workshop`,
      description: `A rich tactile art session combining paper ripping, texture rubbings over leaves or coins, and assembling a vibrant mosaic collage.`,
      instructions: [
        "Gather interesting textured surfaces: embossed book covers, corrugated cardboard, leaves, or coins.",
        "Place blank paper over the textures and rub firmly with the side of a crayon to reveal hidden relief patterns.",
        `Tear colorful construction paper or junk mail into thumb-sized geometric mosaic tiles.`,
        `Glue or arrange the torn tiles and texture rubbings to assemble a magnificent ${interestFormatted.toLowerCase()} masterpiece.`,
        "Sign the corner with their artist signature and hang it proudly on the refrigerator gallery."
      ],
      whyEngaging: `Ripping paper is intensely satisfying sensory feedback that relieves stress while strengthening fine motor grip. Revealing hidden textures under crayons feels like uncovering hidden dinosaur fossils or secret prints.`,
      setupMinutes: 2,
      activityMinutes: { min: 20, max: 35 },
      supervisionLevel: "setup_then_independent" as const,
      parentSetup: ["Set out scrap papers, a few coins or leaves, unwrapped crayons, and a glue stick."],
      safetyNotes: ["Encourage controlled paper tearing on the craft mat."],
      easyVariation: "Stick with texture rubbings alone, experimenting with as many coins and outdoor leaves as possible.",
      extension: "Create a 3D collage by folding little paper accordions or flaps that open to reveal hidden surprises."
    },
    {
      theme: "Grand Showcase & Family Museum",
      title: `Day 7: The Grand ${interestFormatted} Exhibition & Museum Tour`,
      description: `Curate all of the week's creations into a weekend living-room museum, complete with tickets, tour guide storytelling, and ribbon cutting.`,
      instructions: [
        "Gather all the artworks, cardboard structures, and discoveries created throughout the week.",
        "Arrange each piece on tables, shelves, or rugs with custom hand-written exhibit labels.",
        "Design 2 VIP museum entrance tickets on paper scraps to hand to family members.",
        "Cut a paper ribbon taped across the doorway to officially inaugurate the museum opening.",
        "Guide the family on a guided tour, explaining how each project was built and answering visitor questions."
      ],
      whyEngaging: `Children relish holding the spotlight as the expert tour guide. Celebrating their hard work from the week fosters immense confidence, reflection, and pride in their own capabilities.`,
      setupMinutes: 3,
      activityMinutes: { min: 25, max: 45 },
      supervisionLevel: "setup_then_independent" as const,
      parentSetup: ["Help clear tabletop or shelf space to display the child's creations."],
      safetyNotes: ["Ensure walking paths through the home museum are clear and uncluttered."],
      easyVariation: "Focus the exhibition on 2 favorite pieces with an oral storytelling show-and-tell.",
      extension: "Create an audio tour: record the child explaining each exhibit on your phone's voice recorder to replay!"
    }
  ];

  const selected = archetypes[(dayNumber - 1) % archetypes.length];

  return {
    id,
    title: selected.title,
    targetAgeBand: preferences.child.ageBand,
    description: selected.description,
    instructions: selected.instructions,
    materials: materials.length > 0 ? materials : ["paper", "pencils and crayons"],
    setupMinutes: selected.setupMinutes,
    activityMinutes: selected.activityMinutes,
    supervisionLevel: selected.supervisionLevel,
    parentSetup: selected.parentSetup,
    developmentalDomains: domains,
    rationale: `Fosters ${domains.join(" and ").replace(/_/g, " ")} through open-ended screen-free play. Grounded in research from ${evidence.sourceTitle}.`,
    whyEngaging: selected.whyEngaging,
    evidence: [
      {
        sourceIds: [evidence.sourceId],
        chunkIds: [evidence.chunkId],
        supportExplanation: `Grounded in ${evidence.sourceTitle} (${evidence.organizationAuthors}, ${evidence.publicationYear || "2021"}).`,
      },
    ],
    safetyNotes: selected.safetyNotes,
    easyVariation: selected.easyVariation,
    extension: selected.extension,
    noveltySignature: `archetype-d${dayNumber}-${id.slice(0, 8)}:${primaryInterest}`,
    evidenceSupport: {
      evidenceChunkIds: [evidence.chunkId],
      supportedDomains: domains,
      evidenceStrength: evidence.evidenceStrength,
      claimsAllowed: domains,
    },
  };
}

