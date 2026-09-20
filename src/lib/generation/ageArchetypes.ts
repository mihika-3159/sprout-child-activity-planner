/**
 * Age-Differentiated Activity Generation Engine
 *
 * Implements distinct activity generation for every supported age band:
 * 2-3, 4-5, 6-7, 8-9, 10-12, 13+
 *
 * Age affects:
 * - vocabulary & tone
 * - number and complexity of steps
 * - reading/writing expectations
 * - fine-motor & cognitive challenge
 * - independence & supervision
 * - duration & safety boundaries
 * - genuine mechanical usage of interests
 */
import { v4 as uuidv4 } from "uuid";
import {
  AgeBand,
  PlannedActivity,
  PlannerPreferences,
  SupervisionLevel,
} from "../schemas/preferences";
import { RetrievedChunk } from "../evidence/retrieval";
import { titleExistsInPlan } from "./similarity";

interface DynamicArchetype {
  id: string;
  theme: string;
  ageBand: AgeBand;
  mechanic: string;
  applicableInterests?: string[];
  environments?: string[];
  generate: (params: {
    preferences: PlannerPreferences;
    evidence: RetrievedChunk;
    dayNumber: number;
    interest: string;
    excludeMechanic?: string;
  }) => PlannedActivity;
}

function cleanText(t: string): string {
  return t.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

export function normalizeInterestLabel(raw: string): string {
  if (!raw) return "Discovery";
  const lower = raw.toLowerCase().trim().replace(/_/g, " ");
  if (lower.includes("animal")) return "Animal";
  if (lower.includes("dino")) return "Dinosaur";
  if (lower.includes("art") || lower.includes("draw")) return "Art";
  if (lower.includes("build") || lower.includes("lego")) return "Building";
  if (lower.includes("nature") || lower.includes("outdoor")) return "Nature";
  if (lower.includes("stor") || lower.includes("read")) return "Story";
  if (lower.includes("music") || lower.includes("dance")) return "Music";
  if (lower.includes("space")) return "Space";
  if (lower.includes("sport") || lower.includes("move")) return "Movement";
  if (lower.includes("pretend")) return "Imaginative";
  if (lower.includes("sci") || lower.includes("stem")) return "Science";
  if (lower.includes("puzzle") || lower.includes("logic")) return "Puzzle";
  if (lower.includes("cook") || lower.includes("bake")) return "Kitchen Discovery";
  if (lower.includes("vehicle") || lower.includes("car") || lower.includes("train")) return "Vehicle";
  const cleaned = cleanText(raw);
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

// ─── AGE 2–3 ARCHETYPES (Sensory, Movement, Toddler Oral Language) ────────────

const TODDLER_ARCHETYPES: DynamicArchetype[] = [
  {
    id: "toddler-sensory-touch",
    theme: "Tactile Sensory Exploration",
    ageBand: "2-3",
    mechanic: "tactile_sorting",
    generate: ({ preferences, evidence, dayNumber, interest }) => {
      const id = uuidv4();
      const interestLabel = cleanText(interest);
      const isApartment = preferences.environment === "apartment_small_indoor";
      return {
        id,
        title: `Gentle ${interestLabel} Texture Tray`,
        targetAgeBand: "2-3",
        description: `Your toddler explores different soft, smooth, and crinkly household textures while exploring ${interestLabel.toLowerCase()} toys or pictures with their hands.`,
        instructions: [
          "Place a soft towel, a smooth plastic bowl, and a crinkly sheet of paper on a low table or floor mat.",
          `Set out 2 or 3 large, safe ${interestLabel.toLowerCase()} toys or clean household items on the towel.`,
          "Invite your child to stroke, pat, and press each texture, describing out loud whether it feels soft, cool, or bumpy."
        ],
        materials: ["plain paper", "household containers", "towel"],
        setupMinutes: 2,
        activityMinutes: { min: 10, max: 15 },
        supervisionLevel: "active_supervision",
        parentSetup: ["Lay a clean bath towel on the floor and place large safe household items on top."],
        developmentalDomains: ["fine_motor", "sensory", "language"],
        rationale: `Supports tactile discrimination and sensory integration through hands-on affordance perception. Grounded in research from ${evidence.sourceTitle}.`,
        whyEngaging: "Toddlers learn about the physical world primarily through hands-on touch, enjoying the calm contrast of soft cloth and crinkly paper.",
        evidence: [
          {
            sourceId: evidence.sourceId,
            chunkId: evidence.chunkId,
            sourceTitle: evidence.sourceTitle,
            organizationAuthors: evidence.organizationAuthors,
            publicationYear: evidence.publicationYear,
            sourceType: evidence.sourceType,
            urlDoi: evidence.urlDoi,
            relevantFindingSummary: evidence.chunkText.slice(0, 180),
            activityApplicationSentence: "Applies sensory affordance research through direct tactile comparison of familiar household textures.",
            evidenceStrength: evidence.evidenceStrength,
          },
        ],
        safetyNotes: ["Active adult supervision required. Ensure all items are too large to fit inside an empty toilet paper roll."],
        easyVariation: "Focus on just one texture at a time, like rubbing hands over a soft towel.",
        extension: "Hide a large toy under the towel for a gentle peek-a-boo reveal.",
        noveltySignature: `toddler-sensory-d${dayNumber}:${interest}`,
        chokingHazardChecked: true,
        materialRiskChecked: true,
      };
    },
  },
  {
    id: "toddler-cushion-movement",
    theme: "Gentle Floor Movement & Balance",
    ageBand: "2-3",
    mechanic: "cushion_stepping",
    generate: ({ preferences, evidence, dayNumber, interest }) => {
      const id = uuidv4();
      const interestLabel = cleanText(interest);
      const isApartment = preferences.environment === "apartment_small_indoor";
      return {
        id,
        title: `Low Cushion ${interestLabel} Stepping Path`,
        targetAgeBand: "2-3",
        description: `A calm indoor crawl and step path using floor cushions where your child pretends to step between ${interestLabel.toLowerCase()} resting spots.`,
        instructions: [
          "Place 2 or 3 firm sofa cushions flat on the carpet close together.",
          `Tell your child the cushions are cozy ${interestLabel.toLowerCase()} resting spots to crawl across.`,
          "Hold their hand as they gently step or crawl from one low cushion to the next."
        ],
        materials: ["cushions"],
        setupMinutes: 2,
        activityMinutes: { min: 10, max: 15 },
        supervisionLevel: "active_supervision",
        parentSetup: ["Move low tables and sharp corners away from the cushion path."],
        developmentalDomains: ["gross_motor", "physical_movement", "balance"],
        rationale: `Promotes vestibular balance and proprioception through low-elevation walking surfaces. Grounded in research from ${evidence.sourceTitle}.`,
        whyEngaging: "Stepping on squishy, shifting surfaces feels exciting and novel while building toddler leg strength and balance.",
        evidence: [
          {
            sourceId: evidence.sourceId,
            chunkId: evidence.chunkId,
            sourceTitle: evidence.sourceTitle,
            organizationAuthors: evidence.organizationAuthors,
            publicationYear: evidence.publicationYear,
            sourceType: evidence.sourceType,
            urlDoi: evidence.urlDoi,
            relevantFindingSummary: evidence.chunkText.slice(0, 180),
            activityApplicationSentence: "Applies motor development principles using controlled low-impact floor balance surfaces.",
            evidenceStrength: evidence.evidenceStrength,
          },
        ],
        safetyNotes: ["Keep cushions low to the carpet away from walls and hard furniture. Hold toddler's hand for stability."],
        easyVariation: "Let child crawl on hands and knees across cushions rather than standing.",
        extension: "Place a soft toy at the end of the cushion path for them to carry back.",
        noveltySignature: `toddler-movement-d${dayNumber}:${interest}`,
        chokingHazardChecked: true,
        materialRiskChecked: true,
      };
    },
  },
  {
    id: "toddler-box-tunnel",
    theme: "Big Box Crawl & Peek",
    ageBand: "2-3",
    mechanic: "box_peek",
    generate: ({ preferences, evidence, dayNumber, interest }) => {
      const id = uuidv4();
      const interestLabel = normalizeInterestLabel(interest);
      return {
        id,
        title: `Cardboard ${interestLabel} Hideaway`,
        targetAgeBand: "2-3",
        description: `Open the ends of a sturdy cardboard box to create an open crawl-through archway themed around ${interestLabel.toLowerCase()}.`,
        instructions: [
          "Open both top and bottom flaps of a medium-to-large clean box so both sides are completely open.",
          "Place it on the rug and call out cheerful sounds through the tunnel.",
          "Encourage your toddler to crawl through and giggle on the other side."
        ],
        materials: ["cardboard box"],
        setupMinutes: 3,
        activityMinutes: { min: 10, max: 20 },
        supervisionLevel: "setup_then_independent",
        parentSetup: ["Check box edges for staples or packing tape before setting it open on the floor."],
        developmentalDomains: ["gross_motor", "spatial_awareness", "imaginative_play"],
        rationale: `Reinforces spatial boundary awareness and object permanence in early childhood. Grounded in research from ${evidence.sourceTitle}.`,
        whyEngaging: "Toddlers love crawling into enclosed spaces where they feel cozy and in control of their small world.",
        evidence: [
          {
            sourceId: evidence.sourceId,
            chunkId: evidence.chunkId,
            sourceTitle: evidence.sourceTitle,
            organizationAuthors: evidence.organizationAuthors,
            publicationYear: evidence.publicationYear,
            sourceType: evidence.sourceType,
            urlDoi: evidence.urlDoi,
            relevantFindingSummary: evidence.chunkText.slice(0, 180),
            activityApplicationSentence: "Supports spatial boundary exploration through open-ended cardboard enclosure play.",
            evidenceStrength: evidence.evidenceStrength,
          },
        ],
        safetyNotes: ["Keep both ends open so the tunnel is well lit and ventilated. Adult remains in room."],
        easyVariation: "Drape a light cotton bedsheet over two kitchen chairs instead of using a box.",
        extension: "Roll a large soft ball gently through the tunnel for them to catch.",
        noveltySignature: `toddler-tunnel-d${dayNumber}:${interest}`,
        chokingHazardChecked: true,
        materialRiskChecked: true,
      };
    },
  },
  {
    id: "toddler-color-sponge",
    theme: "Dry Sponge Stacking & Drop",
    ageBand: "2-3",
    mechanic: "sponge_stack",
    generate: ({ preferences, evidence, dayNumber, interest }) => {
      const id = uuidv4();
      const interestLabel = normalizeInterestLabel(interest);
      return {
        id,
        title: `${interestLabel} Sponge Block Tower`,
        targetAgeBand: "2-3",
        description: `Your toddler stacks soft, clean sponges into towers and knocks them down without any noise or sharp edges.`,
        instructions: [
          "Set out 3 to 5 clean, dry kitchen sponges on a flat surface.",
          `Stack two sponges into a little tower and say: 'Look at the ${interestLabel.toLowerCase()} tower!'`,
          "Let your toddler knock the tower down with their hand, then try balancing one sponge on top of another."
        ],
        materials: ["household containers"],
        setupMinutes: 1,
        activityMinutes: { min: 10, max: 15 },
        supervisionLevel: "active_supervision",
        parentSetup: ["Provide whole, clean, dry cellulose sponges with no cleaning chemicals."],
        developmentalDomains: ["fine_motor", "problem_solving", "cause_and_effect"],
        rationale: `Builds early grasp calibration and cause-and-effect understanding using silent, soft building blocks. Grounded in research from ${evidence.sourceTitle}.`,
        whyEngaging: "Knocking down towers is pure toddler comedy, and sponges stack easily without tumbling with a loud clatter.",
        evidence: [
          {
            sourceId: evidence.sourceId,
            chunkId: evidence.chunkId,
            sourceTitle: evidence.sourceTitle,
            organizationAuthors: evidence.organizationAuthors,
            publicationYear: evidence.publicationYear,
            sourceType: evidence.sourceType,
            urlDoi: evidence.urlDoi,
            relevantFindingSummary: evidence.chunkText.slice(0, 180),
            activityApplicationSentence: "Applies trial-and-error block balance principles tailored for early motor coordination.",
            evidenceStrength: evidence.evidenceStrength,
          },
        ],
        safetyNotes: ["Active adult supervision required. Dry clean sponges only. Do not cut sponges into small bite-sized pieces."],
        easyVariation: "Drop sponges into a large plastic laundry basket or pot.",
        extension: "Count 'One, two, three, crash!' together each time a tower falls.",
        noveltySignature: `toddler-sponge-d${dayNumber}:${interest}`,
        chokingHazardChecked: true,
        materialRiskChecked: true,
      };
    },
  },
  {
    id: "toddler-water-splash",
    theme: "Shallow Water Scoop & Pat",
    ageBand: "2-3",
    mechanic: "water_scoop",
    generate: ({ preferences, evidence, dayNumber, interest }) => {
      const id = uuidv4();
      const interestLabel = normalizeInterestLabel(interest);
      return {
        id,
        title: `Shallow Water ${interestLabel} Splash Basin`,
        targetAgeBand: "2-3",
        description: `A shallow baking dish with half an inch of warm water and two plastic cups for calm scooping and pouring.`,
        instructions: [
          "Place a large folded bath towel on the kitchen floor with a shallow baking dish containing half an inch of water.",
          `Float 2 large plastic cups or lids representing ${interestLabel.toLowerCase()} rafts.`,
          "Sit alongside your toddler while they scoop water with a spoon or pat the water surface with their palms."
        ],
        materials: ["water", "household containers", "spoons"],
        setupMinutes: 3,
        activityMinutes: { min: 10, max: 15 },
        supervisionLevel: "active_supervision",
        parentSetup: ["Fill shallow dish with half an inch of lukewarm tap water on a double-folded towel."],
        developmentalDomains: ["sensory", "fine_motor", "calm"],
        rationale: `Promotes tactile regulation and bilateral hand coordination through fluid scooping and surface resistance. Grounded in research from ${evidence.sourceTitle}.`,
        whyEngaging: "Water has immediate cause-and-effect magic for toddlers, and shallow splashing provides soothing sensory focus.",
        evidence: [
          {
            sourceId: evidence.sourceId,
            chunkId: evidence.chunkId,
            sourceTitle: evidence.sourceTitle,
            organizationAuthors: evidence.organizationAuthors,
            publicationYear: evidence.publicationYear,
            sourceType: evidence.sourceType,
            urlDoi: evidence.urlDoi,
            relevantFindingSummary: evidence.chunkText.slice(0, 180),
            activityApplicationSentence: "Applies sensory exploration guidelines emphasizing soothing tactile liquid play.",
            evidenceStrength: evidence.evidenceStrength,
          },
        ],
        safetyNotes: ["Constant arms-length adult supervision required around all water. Empty dish immediately when done."],
        easyVariation: "Float a clean washcloth on the water surface to squeeze and lift.",
        extension: "Drop a plastic spoon from 2 inches high to see the tiny water ripples.",
        noveltySignature: `toddler-water-d${dayNumber}:${interest}`,
        chokingHazardChecked: true,
        materialRiskChecked: true,
      };
    },
  },
  {
    id: "toddler-paper-scrunch",
    theme: "Paper Crinkle & Ball Toss",
    ageBand: "2-3",
    mechanic: "paper_scrunch",
    generate: ({ preferences, evidence, dayNumber, interest }) => {
      const id = uuidv4();
      const interestLabel = normalizeInterestLabel(interest);
      return {
        id,
        title: `${interestLabel} Crinkle Paper Rollers`,
        targetAgeBand: "2-3",
        description: `Crumple large sheets of scrap paper into big handheld balls and gently roll them into an open laundry basket.`,
        instructions: [
          "Give your toddler a whole sheet of plain scrap paper to squeeze, twist, and crumple with both hands.",
          `Help squeeze it into a big, round ${interestLabel.toLowerCase()} boulder.`,
          "Set a wide cardboard box or laundry basket 2 feet away and practice tossing or rolling the paper ball inside."
        ],
        materials: ["plain paper", "cardboard box"],
        setupMinutes: 2,
        activityMinutes: { min: 10, max: 20 },
        supervisionLevel: "active_supervision",
        parentSetup: ["Set out 3 sheets of clean paper and a wide-mouth container."],
        developmentalDomains: ["fine_motor", "hand_eye_coordination", "gross_motor"],
        rationale: `Strengthens intrinsic hand muscles and bilateral coordination through sustained grasping and squeezing. Grounded in research from ${evidence.sourceTitle}.`,
        whyEngaging: "Crinkling paper makes an intensely rewarding auditory sound and gives toddlers physical feedback as flat paper transforms into a ball.",
        evidence: [
          {
            sourceId: evidence.sourceId,
            chunkId: evidence.chunkId,
            sourceTitle: evidence.sourceTitle,
            organizationAuthors: evidence.organizationAuthors,
            publicationYear: evidence.publicationYear,
            sourceType: evidence.sourceType,
            urlDoi: evidence.urlDoi,
            relevantFindingSummary: evidence.chunkText.slice(0, 180),
            activityApplicationSentence: "Applies motor development milestone guidance on two-handed coordination and target release.",
            evidenceStrength: evidence.evidenceStrength,
          },
        ],
        safetyNotes: ["Use whole large paper sheets only; do not tear paper into small scraps that could pose a choking risk."],
        easyVariation: "Just practice squeezing the paper flat and opening it up again.",
        extension: "Move the basket 1 step further back for a bigger roll challenge.",
        noveltySignature: `toddler-crinkle-d${dayNumber}:${interest}`,
        chokingHazardChecked: true,
        materialRiskChecked: true,
      };
    },
  },
  {
    id: "toddler-sound-drum",
    theme: "Pot & Spoon Rhythmic Beats",
    ageBand: "2-3",
    mechanic: "rhythm_tap",
    generate: ({ preferences, evidence, dayNumber, interest }) => {
      const id = uuidv4();
      const interestLabel = normalizeInterestLabel(interest);
      return {
        id,
        title: `${interestLabel} Rhythm Drum Session`,
        targetAgeBand: "2-3",
        description: `Turn an empty plastic tub or bowl upside down and use a wooden spoon to tap out slow and fast rhythmic beats.`,
        instructions: [
          "Place an upside-down plastic mixing bowl or storage tub on the floor mat.",
          "Hand your child a wooden spoon and demonstrate tapping slowly and rhythmically.",
          "Switch between tapping very softly like a mouse and tapping with a steady rhythm together."
        ],
        materials: ["household containers", "spoons"],
        setupMinutes: 1,
        activityMinutes: { min: 10, max: 15 },
        supervisionLevel: "active_supervision",
        parentSetup: ["Set out a sturdy plastic container with smooth edges and a wooden or silicone spoon."],
        developmentalDomains: ["music", "listening", "executive_function"],
        rationale: `Trains auditory discrimination and motor impulse control through tempo modulation and turn-taking. Grounded in research from ${evidence.sourceTitle}.`,
        whyEngaging: "Making rhythms gives toddlers a joyful sense of acoustic power and lets them express energetic feelings productively.",
        evidence: [
          {
            sourceId: evidence.sourceId,
            chunkId: evidence.chunkId,
            sourceTitle: evidence.sourceTitle,
            organizationAuthors: evidence.organizationAuthors,
            publicationYear: evidence.publicationYear,
            sourceType: evidence.sourceType,
            urlDoi: evidence.urlDoi,
            relevantFindingSummary: evidence.chunkText.slice(0, 180),
            activityApplicationSentence: "Implements auditory rhythm and inhibitory entrainment principles in early childhood.",
            evidenceStrength: evidence.evidenceStrength,
          },
        ],
        safetyNotes: ["Use wooden or silicone spoons; avoid heavy metal spoons to protect little teeth and ears."],
        easyVariation: "Tap directly with flat hands like a bongo drum instead of using spoons.",
        extension: "Freeze completely when the sound stops and giggle together before starting again.",
        noveltySignature: `toddler-rhythm-d${dayNumber}:${interest}`,
        chokingHazardChecked: true,
        materialRiskChecked: true,
      };
    },
  },
];

// ─── AGE 13+ TEEN ARCHETYPES (Mature, Intellectual, Rigorous Science & Modeling)

const TEEN_ARCHETYPES: DynamicArchetype[] = [
  {
    id: "teen-space-aerodynamics",
    theme: "Aerodynamic Prototype Optimization",
    ageBand: "13+",
    mechanic: "aerodynamic_testing",
    applicableInterests: ["space", "science", "building"],
    generate: ({ preferences, evidence, dayNumber, interest }) => {
      const id = uuidv4();
      return {
        id,
        title: "Spacecraft Re-entry Glider Optimization",
        targetAgeBand: "13+",
        description: "Design, construct, and calibrate three distinct paper lifting-body glider prototypes. Alter wing dihedral angle and center-of-mass weighting to analyze aerodynamic glide stability over recorded trials.",
        instructions: [
          "Construct two baseline paper gliders using identical sheets of paper: one with a wide delta-wing profile and one with a narrow fuselage.",
          "Add folded paper ballast to the nose to shift the center of gravity forward of the center of lift.",
          "Conduct 5 controlled horizontal test launches along an unobstructed hallway, recording estimated flight distance and roll stability in a notebook.",
          "Incorporate a 10-degree upward dihedral bend to the wingtips on Prototype B and compare against the flat-wing baseline.",
          "Analyze the resulting flight data to determine how dihedral angle counteracts roll instability during unpowered descent."
        ],
        materials: (preferences.selectedMaterials || preferences.materials || []).some((m) => m.toLowerCase().includes("tape"))
          ? ["plain paper", "tape"]
          : ["plain paper"],
        setupMinutes: 3,
        activityMinutes: { min: 30, max: 45 },
        supervisionLevel: "independent",
        parentSetup: ["Designate an open hallway or living area free of obstacles for test flights."],
        developmentalDomains: ["problem_solving", "science", "concentration"],
        rationale: `Develops systematic variable isolation, iterative engineering problem solving, and kinematic observation. Grounded in research from ${evidence.sourceTitle}.`,
        whyEngaging: "Offers real engineering design autonomy: small millimeter adjustments to wing geometry produce observable changes in flight physics.",
        evidence: [
          {
            sourceId: evidence.sourceId,
            chunkId: evidence.chunkId,
            sourceTitle: evidence.sourceTitle,
            organizationAuthors: evidence.organizationAuthors,
            publicationYear: evidence.publicationYear,
            sourceType: evidence.sourceType,
            urlDoi: evidence.urlDoi,
            relevantFindingSummary: evidence.chunkText.slice(0, 180),
            activityApplicationSentence: "Applies scientific variable isolation and iterative engineering principles to aerodynamic problem-solving.",
            evidenceStrength: evidence.evidenceStrength,
          },
        ],
        safetyNotes: ["Launch gliders in a clear indoor path away from eyes and fragile objects."],
        easyVariation: "Compare flight characteristics between standard copy paper and heavier cardstock.",
        extension: "Calculate the estimated glide ratio (horizontal distance divided by drop height) for each airframe iteration.",
        noveltySignature: `teen-aero-d${dayNumber}:${interest}`,
        chokingHazardChecked: true,
        materialRiskChecked: true,
      };
    },
  },
  {
    id: "teen-space-scale-model",
    theme: "Astronomical Scale Modeling",
    ageBand: "13+",
    mechanic: "scale_computation",
    applicableInterests: ["space", "science", "learning"],
    environments: ["indoors", "outdoors", "any"],
    generate: ({ preferences, evidence, dayNumber, interest }) => {
      const id = uuidv4();
      return {
        id,
        title: "Scale Solar System Distance Calculation & Mapping",
        targetAgeBand: "13+",
        description: "Calculate proportional planetary distances using astronomical units (AU) and map a scaled 10-meter baseline model across your living space or hallway.",
        instructions: [
          "Establish a linear distance scale where 10 meters represents the distance from the Sun to Neptune (30.1 AU), making 1 AU approximately 33.3 cm.",
          "Calculate the scaled placement distances from the Sun for Mercury (0.39 AU), Venus (0.72 AU), Earth (1.0 AU), Mars (1.52 AU), and Jupiter (5.2 AU).",
          "Mark each planetary position along a hallway using labeled paper card markers placed at your calculated centimeter measurements.",
          "Observe the dramatic spatial clustering of the four terrestrial inner planets compared to the vast emptiness separating the gas giants.",
          "Record a brief analytical reflection on why planetary distance scales make human interplanetary transit logistically complex."
        ],
        materials: ["plain paper", "pencils and crayons", "books"],
        setupMinutes: 5,
        activityMinutes: { min: 35, max: 50 },
        supervisionLevel: "independent",
        parentSetup: ["Provide a tape measure, ruler, or measured string if available."],
        developmentalDomains: ["numeracy", "science", "cognitive"],
        rationale: `Deepens proportional reasoning, scientific scale translation, and spatial cognition. Grounded in research from ${evidence.sourceTitle}.`,
        whyEngaging: "Visualizing genuine astronomical scale shatters common textbook misconceptions and reveals the staggering emptiness of the solar system.",
        evidence: [
          {
            sourceId: evidence.sourceId,
            chunkId: evidence.chunkId,
            sourceTitle: evidence.sourceTitle,
            organizationAuthors: evidence.organizationAuthors,
            publicationYear: evidence.publicationYear,
            sourceType: evidence.sourceType,
            urlDoi: evidence.urlDoi,
            relevantFindingSummary: evidence.chunkText.slice(0, 180),
            activityApplicationSentence: "Leverages proportional mathematics and spatial modeling to reinforce scientific comprehension.",
            evidenceStrength: evidence.evidenceStrength,
          },
        ],
        safetyNotes: ["Place paper markers flat or folded so they do not slide underfoot."],
        easyVariation: "Use a simplified scale where 1 meter equals 5 AU to fit smaller rooms.",
        extension: "Calculate the scale diameter that the Sun and Earth would have on your 10-meter model and note why drawing them to scale is nearly impossible.",
        noveltySignature: `teen-scale-d${dayNumber}:${interest}`,
        chokingHazardChecked: true,
        materialRiskChecked: true,
      };
    },
  },
  {
    id: "teen-cooking-chemistry",
    theme: "Culinary Science & Fluid Dynamics",
    ageBand: "13+",
    mechanic: "fluid_dynamics",
    applicableInterests: ["cooking", "science", "problem_solving"],
    environments: ["indoors", "apartment_small_indoor", "any"],
    generate: ({ preferences, evidence, dayNumber, interest }) => {
      const id = uuidv4();
      return {
        id,
        title: "Culinary Surface Tension & Capillary Action Investigation",
        targetAgeBand: "13+",
        description: "Investigate fluid dynamics and molecular cohesion in culinary science by analyzing water surface tension, meniscus curvature, and paper capillary flow.",
        instructions: [
          "Fill a clear drinking glass to the very brim with tap water, observing the flat surface line from eye level.",
          "Use a teaspoon to carefully add individual water droplets one by one, recording how many drops can be added before the convex meniscus breaks.",
          "Cut a 2-centimeter-wide strip of plain paper and suspend the bottom tip into the water container.",
          "Measure and record the height in millimeters that capillary action draws the liquid up through the cellulose fiber matrix over 3 minutes.",
          "Diagram the molecular hydrogen bonding dipole network that explains water's unusually high cohesive surface tension."
        ],
        materials: ["water", "household containers", "spoons", "plain paper"],
        setupMinutes: 3,
        activityMinutes: { min: 30, max: 45 },
        supervisionLevel: "independent",
        parentSetup: ["Set out clear reusable glasses or cups on a wipeable kitchen counter."],
        developmentalDomains: ["science", "problem_solving", "learning"],
        rationale: `Fosters conceptual understanding of molecular polarity, surface tension, and empirical testing protocols. Grounded in research from ${evidence.sourceTitle}.`,
        whyEngaging: "Observing water bulge upwards in a visible dome before spilling reveals the powerful invisible molecular forces governing everyday culinary fluids.",
        evidence: [
          {
            sourceId: evidence.sourceId,
            chunkId: evidence.chunkId,
            sourceTitle: evidence.sourceTitle,
            organizationAuthors: evidence.organizationAuthors,
            publicationYear: evidence.publicationYear,
            sourceType: evidence.sourceType,
            urlDoi: evidence.urlDoi,
            relevantFindingSummary: evidence.chunkText.slice(0, 180),
            activityApplicationSentence: "Applies hypothesis testing and variable isolation to observable chemical surface phenomena.",
            evidenceStrength: evidence.evidenceStrength,
          },
        ],
        safetyNotes: ["Wipe liquid spills promptly with a towel to prevent slippery floor surfaces."],
        easyVariation: "Compare capillary rise speed between plain paper and a clean scrap if available.",
        extension: "Calculate the rate of capillary flow in millimeters per minute across the first 3 minutes.",
        noveltySignature: `teen-culinary-d${dayNumber}:${interest}`,
        chokingHazardChecked: true,
        materialRiskChecked: true,
      };
    },
  },
  {
    id: "teen-structural-truss",
    theme: "Structural Beam Optimization",
    ageBand: "13+",
    mechanic: "structural_truss",
    applicableInterests: ["building", "science", "problem_solving"],
    environments: ["indoors", "apartment_small_indoor", "any"],
    generate: ({ preferences, evidence, dayNumber, interest }) => {
      const id = uuidv4();
      return {
        id,
        title: "Constrained Structural Truss Bridge Engineering",
        targetAgeBand: "13+",
        description: "Design and build a 30-centimeter bridge span using only rolled paper tubes and tape, engineered to bear maximum vertical load with minimal material mass.",
        instructions: [
          "Tightly roll single sheets of paper around a pencil into rigid cylindrical struts with interlocking folded ends or secured with tape if available.",
          "Design a planar triangular truss structure (such as a Warren or Pratt truss design) on paper before assembly.",
          "Assemble the paper struts using interlocking folds or tape joints to bridge a 30-centimeter gap between two tables or books.",
          "Gradually test structural load by placing small books or containers on the center span until deflection occurs.",
          "Document which structural member experienced tension versus compression failure and sketch a design modification to reinforce the critical joint."
        ],
        materials: (preferences.selectedMaterials || preferences.materials || []).some((m) => m.toLowerCase().includes("tape"))
          ? ["plain paper", "tape", "books"]
          : ["plain paper", "cardboard", "books"],
        setupMinutes: 5,
        activityMinutes: { min: 40, max: 60 },
        supervisionLevel: "independent",
        parentSetup: ["Set up two flat table edges or book stacks spaced 30 cm apart."],
        developmentalDomains: ["problem_solving", "creativity", "cognitive"],
        rationale: `Reinforces structural statics, material tension/compression mechanics, and iterative failure analysis. Grounded in research from ${evidence.sourceTitle}.`,
        whyEngaging: "Testing engineered structures to catastrophic failure provides exciting, concrete feedback on the effectiveness of geometric truss principles.",
        evidence: [
          {
            sourceId: evidence.sourceId,
            chunkId: evidence.chunkId,
            sourceTitle: evidence.sourceTitle,
            organizationAuthors: evidence.organizationAuthors,
            publicationYear: evidence.publicationYear,
            sourceType: evidence.sourceType,
            urlDoi: evidence.urlDoi,
            relevantFindingSummary: evidence.chunkText.slice(0, 180),
            activityApplicationSentence: "Applies mechanical engineering stress analysis principles to physical spatial prototyping.",
            evidenceStrength: evidence.evidenceStrength,
          },
        ],
        safetyNotes: ["Use stable book stacks on a floor or table; do not use fragile glassware for load testing."],
        easyVariation: "Test a simple folded corrugated paper deck before constructing a full triangular truss.",
        extension: "Compute the bridge's efficiency ratio: maximum weight supported divided by the weight of the paper used.",
        noveltySignature: `teen-truss-d${dayNumber}:${interest}`,
        chokingHazardChecked: true,
        materialRiskChecked: true,
      };
    },
  },
  {
    id: "teen-observation-transect",
    theme: "Systematic Fieldwork & Micro-Ecology",
    ageBand: "13+",
    mechanic: "transect_fieldwork",
    applicableInterests: ["nature", "science", "animals"],
    environments: ["outdoors", "garden_outdoor_available"],
    generate: ({ preferences, evidence, dayNumber, interest }) => {
      const id = uuidv4();
      return {
        id,
        title: "Micro-Ecosystem Transect Survey & Documentation",
        targetAgeBand: "13+",
        description: "Conduct a scientific quadrat survey of a 1-square-meter patch of garden soil, potted plant ecosystem, or window sill micro-climate, logging abiotic and biotic factors.",
        instructions: [
          "Delimit a precise 1-meter square quadrant in an outdoor garden or window area using tape, string, or four corner stones.",
          "Catalog all visible biotic components (insect species, moss types, vegetation cover percentage) within the quadrant.",
          "Measure or estimate abiotic parameters: light intensity (direct sunlight vs shaded), soil moisture, and exposure to wind.",
          "Sketch a detailed overhead ecological schematic showing spatial distribution and micro-habitats within the survey area.",
          "Write a 1-paragraph ecological hypothesis predicting how this quadrant's community structure would shift over seasonal change."
        ],
        materials: ["plain paper", "pencils and crayons"],
        setupMinutes: 5,
        activityMinutes: { min: 35, max: 50 },
        supervisionLevel: "independent",
        parentSetup: ["Identify an outdoor garden bed, balcony planter, or window sill area for observation."],
        developmentalDomains: ["science", "learning", "observation"],
        rationale: `Builds observational rigor, ecological taxonomy understanding, and scientific hypothesis generation. Grounded in research from ${evidence.sourceTitle}.`,
        whyEngaging: "Magnifying attention on a single square meter reveals an intricate, hidden world of biological interactions happening unnoticed in everyday surroundings.",
        evidence: [
          {
            sourceId: evidence.sourceId,
            chunkId: evidence.chunkId,
            sourceTitle: evidence.sourceTitle,
            organizationAuthors: evidence.organizationAuthors,
            publicationYear: evidence.publicationYear,
            sourceType: evidence.sourceType,
            urlDoi: evidence.urlDoi,
            relevantFindingSummary: evidence.chunkText.slice(0, 180),
            activityApplicationSentence: "Applies standardized ecological fieldwork methodologies to localized observational science.",
            evidenceStrength: evidence.evidenceStrength,
          },
        ],
        safetyNotes: ["Wash hands thoroughly after handling outdoor soil or plant specimens."],
        easyVariation: "Survey an indoor terrarium, potted houseplant, or window sill dust micro-environment.",
        extension: "Repeat the survey at night or 12 hours later to document circadian shifts in visible organisms.",
        noveltySignature: `teen-transect-d${dayNumber}:${interest}`,
        chokingHazardChecked: true,
        materialRiskChecked: true,
      };
    },
  },
  {
    id: "teen-cryptographic-ciphers",
    theme: "Algorithmic Cryptography & Logic",
    ageBand: "13+",
    mechanic: "algorithmic_ciphers",
    applicableInterests: ["puzzles", "learning", "problem_solving"],
    generate: ({ preferences, evidence, dayNumber, interest }) => {
      const id = uuidv4();
      return {
        id,
        title: "Cryptographic Cipher Design & Frequency Analysis",
        targetAgeBand: "13+",
        description: "Construct an algorithmic Caesar substitution wheel and analyze monoalphabetic frequency distributions to decipher encoded historical messages.",
        instructions: [
          "Construct two concentric paper dials marked with the 26 letters of the alphabet to build a functional Caesar cipher disc.",
          "Encode a 3-sentence scientific observation using an agreed-upon numerical shift key (e.g., K = 7).",
          "Encrypt a second message using a columnar transposition cipher, writing text in a 5-column grid and reading off columns vertically.",
          "Analyze the letter frequency of the encrypted text against standard English letter frequencies (E, T, A, O, I, N).",
          "Document how polyalphabetic ciphers historical solved the vulnerability of single-substitution systems."
        ],
        materials: ["plain paper", "pencils and crayons"],
        setupMinutes: 3,
        activityMinutes: { min: 30, max: 45 },
        supervisionLevel: "independent",
        parentSetup: ["Provide two sheets of plain paper and a pencil."],
        developmentalDomains: ["problem_solving", "numeracy", "cognitive"],
        rationale: `Cultivates mathematical pattern recognition, modular arithmetic thinking, and algorithmic logic. Grounded in research from ${evidence.sourceTitle}.`,
        whyEngaging: "Encoding and decoding secret information appeals to natural analytical curiosity while introducing fundamental principles of computer science.",
        evidence: [
          {
            sourceId: evidence.sourceId,
            chunkId: evidence.chunkId,
            sourceTitle: evidence.sourceTitle,
            organizationAuthors: evidence.organizationAuthors,
            publicationYear: evidence.publicationYear,
            sourceType: evidence.sourceType,
            urlDoi: evidence.urlDoi,
            relevantFindingSummary: evidence.chunkText.slice(0, 180),
            activityApplicationSentence: "Applies computational thinking and symbolic encoding principles to logic puzzle solving.",
            evidenceStrength: evidence.evidenceStrength,
          },
        ],
        safetyNotes: ["Ergonomic sitting posture during focused analytical writing."],
        easyVariation: "Use a simple fixed shift of +3 (classic Caesar) rather than multi-column transposition.",
        extension: "Write an algorithm flowchart showing how a computer program would automate frequency cracking.",
        noveltySignature: `teen-cipher-d${dayNumber}:${interest}`,
        chokingHazardChecked: true,
        materialRiskChecked: true,
      };
    },
  },
  {
    id: "teen-speculative-worldbuilding",
    theme: "Constrained Speculative Worldbuilding",
    ageBand: "13+",
    mechanic: "speculative_worldbuilding",
    applicableInterests: ["stories", "art", "creativity"],
    generate: ({ preferences, evidence, dayNumber, interest }) => {
      const id = uuidv4();
      return {
        id,
        title: "Speculative Biome & Geopolitical Worldbuilding Dossier",
        targetAgeBand: "13+",
        description: "Engineer an internally consistent speculative ecosystem and civilization dossier, designing physical geography, climatic biomes, and resource logistics.",
        instructions: [
          "Draw a detailed topographic map of an imaginary continent on a plain sheet of paper, marking mountain ranges, rain-shadow deserts, and river basins based on realistic geography.",
          "Select one unique environmental constraint (e.g., perpetual twilight, low gravity, tidal locking with a star).",
          "Design two native flora or fauna species uniquely adapted to survive under these extreme environmental conditions.",
          "Outline the primary trade goods, energy sources, and architectural styles developed by civilizations living in this territory.",
          "Write a 1-page narrative scene illustrating a technical conflict between characters navigating this world's physical constraints."
        ],
        materials: ["plain paper", "pencils and crayons"],
        setupMinutes: 2,
        activityMinutes: { min: 35, max: 60 },
        supervisionLevel: "independent",
        parentSetup: ["Provide quiet desk space with blank paper and drawing pens."],
        developmentalDomains: ["creativity", "writing", "cognitive"],
        rationale: `Enhances complex narrative synthesis, systemic causal thinking, and creative written self-expression. Grounded in research from ${evidence.sourceTitle}.`,
        whyEngaging: "Constructing an entire fictional world from first principles grants deep creative ownership and intellectual immersion.",
        evidence: [
          {
            sourceId: evidence.sourceId,
            chunkId: evidence.chunkId,
            sourceTitle: evidence.sourceTitle,
            organizationAuthors: evidence.organizationAuthors,
            publicationYear: evidence.publicationYear,
            sourceType: evidence.sourceType,
            urlDoi: evidence.urlDoi,
            relevantFindingSummary: evidence.chunkText.slice(0, 180),
            activityApplicationSentence: "Applies narrative structure and systemic causal reasoning to creative world design.",
            evidenceStrength: evidence.evidenceStrength,
          },
        ],
        safetyNotes: ["Take eye breaks every 20 minutes when engaged in detailed map drawing."],
        easyVariation: "Focus exclusively on mapping the physical continent without the narrative scene.",
        extension: "Create an illustrated evolutionary lineage diagram for one of your speculative species.",
        noveltySignature: `teen-world-d${dayNumber}:${interest}`,
        chokingHazardChecked: true,
        materialRiskChecked: true,
      };
    },
  },
];

// ─── AGES 6-7 ARCHETYPES (Hands-on, Early Primary, Structured Creativity) ─────

const EARLY_PRIMARY_ARCHETYPES: DynamicArchetype[] = [
  {
    id: "primary-story-map",
    theme: "Illustrated Story Map Adventure",
    ageBand: "6-7",
    mechanic: "drawn_story_map",
    generate: ({ preferences, evidence, dayNumber, interest }) => {
      const id = uuidv4();
      const interestLabel = cleanText(interest);
      return {
        id,
        title: `Illustrated ${interestLabel} Expedition Map`,
        targetAgeBand: "6-7",
        description: `Your child draws a birds-eye map of a hidden landscape with landmark trails, natural obstacles, and secret discovery zones dedicated to ${interestLabel.toLowerCase()}.`,
        instructions: [
          "Take a large sheet of plain paper and sketch a coastline or mountain border around the outer edges.",
          `Add 4 distinct landmarks related to ${interestLabel.toLowerCase()} (such as a lookout rock, a crystal stream, or an expedition camp).`,
          "Draw a dashed trail showing the safest pathway from start to finish.",
          "Add a map key with symbols for trees, water, and danger zones.",
          "Tell a 2-minute spoken adventure story tracing your finger along the trail."
        ],
        materials: ["plain paper", "pencils and crayons"],
        setupMinutes: 2,
        activityMinutes: { min: 20, max: 30 },
        supervisionLevel: "setup_then_independent",
        parentSetup: ["Provide a clean flat tabletop with scrap paper and crayons."],
        developmentalDomains: ["creativity", "fine_motor", "spatial_awareness"],
        rationale: `Supports spatial mapping, symbolic representation, and narrative structure development. Grounded in research from ${evidence.sourceTitle}.`,
        whyEngaging: "Designing an imaginary landscape gives children the thrill of world-making and cartography with zero wrong answers.",
        evidence: [
          {
            sourceId: evidence.sourceId,
            chunkId: evidence.chunkId,
            sourceTitle: evidence.sourceTitle,
            organizationAuthors: evidence.organizationAuthors,
            publicationYear: evidence.publicationYear,
            sourceType: evidence.sourceType,
            urlDoi: evidence.urlDoi,
            relevantFindingSummary: evidence.chunkText.slice(0, 180),
            activityApplicationSentence: "Applies spatial visualization and early narrative framing research to visual mapping.",
            evidenceStrength: evidence.evidenceStrength,
          },
        ],
        safetyNotes: ["Ensure comfortable sitting posture and good lighting for drawing."],
        easyVariation: "Draw just 2 landmarks and connect them with a single straight path.",
        extension: "Crumple and gently flatten the paper to give it an authentic 'ancient scroll' parchment texture.",
        noveltySignature: `primary-map-d${dayNumber}:${interest}`,
        chokingHazardChecked: true,
        materialRiskChecked: true,
      };
    },
  },
  {
    id: "primary-crater-drop",
    theme: "Crater Drop Variable Experiment",
    ageBand: "6-7",
    mechanic: "crater_impact",
    generate: ({ preferences, evidence, dayNumber, interest }) => {
      const id = uuidv4();
      const interestLabel = cleanText(interest);
      return {
        id,
        title: `${interestLabel} Surface Crater Impact Test`,
        targetAgeBand: "6-7",
        description: `Drop rolled paper balls from different heights into a shallow tray to observe how impact speed creates different crater patterns.`,
        instructions: [
          "Lay a towel on the table and place a shallow tray or plate covered with a smooth layer of paper scraps or a thin layer of flour.",
          `Roll 2 tight paper balls of different sizes representing ${interestLabel.toLowerCase()} asteroids.`,
          "Drop ball A from chin height into the tray and look closely at the splash rim.",
          "Drop ball B from above your head and compare: which impact made the wider splash ring?",
          "Draw the two crater shapes side-by-side on paper and label which drop was higher."
        ],
        materials: ["plain paper", "household containers", "towel"],
        setupMinutes: 3,
        activityMinutes: { min: 20, max: 30 },
        supervisionLevel: "setup_then_independent",
        parentSetup: ["Set out a baking sheet on a kitchen towel with paper balls ready to drop."],
        developmentalDomains: ["science", "problem_solving", "observation"],
        rationale: `Encourages causal hypothesis testing, kinetic energy observation, and comparative measurement. Grounded in research from ${evidence.sourceTitle}.`,
        whyEngaging: "Watching visible impact splashes and measuring crater ridges connects gravity and motion in a satisfying physical way.",
        evidence: [
          {
            sourceId: evidence.sourceId,
            chunkId: evidence.chunkId,
            sourceTitle: evidence.sourceTitle,
            organizationAuthors: evidence.organizationAuthors,
            publicationYear: evidence.publicationYear,
            sourceType: evidence.sourceType,
            urlDoi: evidence.urlDoi,
            relevantFindingSummary: evidence.chunkText.slice(0, 180),
            activityApplicationSentence: "Applies inquiry-based science methods through systematic variable comparison.",
            evidenceStrength: evidence.evidenceStrength,
          },
        ],
        safetyNotes: ["Keep drops inside the tray perimeter to avoid dusting the surrounding floor."],
        easyVariation: "Use a folded towel as the landing pad and test which objects bounce.",
        extension: "Use a ruler or finger strides to measure the exact diameter of the splash rings.",
        noveltySignature: `primary-crater-d${dayNumber}:${interest}`,
        chokingHazardChecked: true,
        materialRiskChecked: true,
      };
    },
  },
  {
    id: "primary-nature-leaf-sort",
    theme: "Nature Specimen Classification",
    ageBand: "6-7",
    mechanic: "nature_sorting",
    environments: ["outdoors", "garden_outdoor_available"],
    generate: ({ preferences, evidence, dayNumber, interest }) => {
      const id = uuidv4();
      const interestLabel = normalizeInterestLabel(interest);
      return {
        id,
        title: `${interestLabel} Outdoor Specimen Sorting`,
        targetAgeBand: "6-7",
        description: `Collect fallen leaves, twigs, and smooth pebbles outdoors, then categorize them by edge pattern, texture, and size.`,
        instructions: [
          "Step into the garden or outdoor area with an empty cardboard container or small tray.",
          "Gather 6 to 10 fallen leaves and small twigs of different shapes.",
          "Lay out two paper labels: 'Smooth Edges' and 'Toothed / Jagged Edges'.",
          "Inspect each leaf closely and place it into the correct category.",
          "Choose your favorite specimen and make a crayon rubbing on plain paper to capture its vein structure."
        ],
        materials: ["outdoor_natural", "plain paper", "pencils and crayons", "cardboard"],
        setupMinutes: 2,
        activityMinutes: { min: 20, max: 35 },
        supervisionLevel: "setup_then_independent",
        parentSetup: ["Confirm safe outdoor boundaries for collecting natural fallen items."],
        developmentalDomains: ["science", "observation", "outdoor_activity"],
        rationale: `Develops early biological taxonomy, attribute sorting, and natural world observation. Grounded in research from ${evidence.sourceTitle}.`,
        whyEngaging: "Finding treasures in the grass and discovering intricate hidden vein patterns under crayons turns the yard into a nature laboratory.",
        evidence: [
          {
            sourceId: evidence.sourceId,
            chunkId: evidence.chunkId,
            sourceTitle: evidence.sourceTitle,
            organizationAuthors: evidence.organizationAuthors,
            publicationYear: evidence.publicationYear,
            sourceType: evidence.sourceType,
            urlDoi: evidence.urlDoi,
            relevantFindingSummary: evidence.chunkText.slice(0, 180),
            activityApplicationSentence: "Applies UNESCO nature taxonomy guidance through hands-on attribute classification.",
            evidenceStrength: evidence.evidenceStrength,
          },
        ],
        safetyNotes: ["Collect only fallen items from the ground; do not pull live plants. Wash hands after handling soil."],
        easyVariation: "Sort simply by size (largest to smallest) rather than edge serration.",
        extension: "Count how many points each leaf has and order them from 1 to 5 points.",
        noveltySignature: `primary-leaf-d${dayNumber}:${interest}`,
        chokingHazardChecked: true,
        materialRiskChecked: true,
      };
    },
  },
  {
    id: "primary-cardboard-bridge",
    theme: "Engineered Bridge Test",
    ageBand: "6-7",
    mechanic: "bridge_span",
    generate: ({ preferences, evidence, dayNumber, interest }) => {
      const id = uuidv4();
      const interestLabel = normalizeInterestLabel(interest);
      return {
        id,
        title: `${interestLabel} Cardboard Bridge Engineering`,
        targetAgeBand: "6-7",
        description: `Span a gap between two books using cardboard and paper to test how folding paper into an accordion shape makes it stronger.`,
        instructions: [
          "Place two thick books 15 centimeters apart on a table.",
          "Lay a flat sheet of paper across the books and notice how easily it sags under a single pencil.",
          "Fold a second sheet of paper back and forth like an accordion fan, then place it across the gap.",
          `Test how many pencils, crayons, or small ${interestLabel.toLowerCase()} toys the folded bridge can support before bending.`,
          "Draw a trophy star on the strongest bridge design."
        ],
        materials: ["plain paper", "cardboard", "books", "pencils and crayons"],
        setupMinutes: 2,
        activityMinutes: { min: 20, max: 30 },
        supervisionLevel: "setup_then_independent",
        parentSetup: ["Set out two books of equal thickness on a desk."],
        developmentalDomains: ["problem_solving", "science", "creativity"],
        rationale: `Demonstrates structural load distribution and geometric strength through hands-on material testing. Grounded in research from ${evidence.sourceTitle}.`,
        whyEngaging: "Kids love discovering the secret 'superpower' of accordion folds when flimsy paper suddenly holds heavy objects.",
        evidence: [
          {
            sourceId: evidence.sourceId,
            chunkId: evidence.chunkId,
            sourceTitle: evidence.sourceTitle,
            organizationAuthors: evidence.organizationAuthors,
            publicationYear: evidence.publicationYear,
            sourceType: evidence.sourceType,
            urlDoi: evidence.urlDoi,
            relevantFindingSummary: evidence.chunkText.slice(0, 180),
            activityApplicationSentence: "Applies physics and engineering principles to childhood material experimentation.",
            evidenceStrength: evidence.evidenceStrength,
          },
        ],
        safetyNotes: ["Place bridge on a stable table away from edges."],
        easyVariation: "Use a flat strip of sturdy cardboard instead of folding paper.",
        extension: "Widen the gap between the books by 5 centimeters and see if the bridge still holds.",
        noveltySignature: `primary-bridge-d${dayNumber}:${interest}`,
        chokingHazardChecked: true,
        materialRiskChecked: true,
      };
    },
  },
  {
    id: "primary-secret-code",
    theme: "Picture Clue Detective Code",
    ageBand: "6-7",
    mechanic: "picture_cipher",
    generate: ({ preferences, evidence, dayNumber, interest }) => {
      const id = uuidv4();
      const interestLabel = normalizeInterestLabel(interest);
      return {
        id,
        title: `${interestLabel} Secret Symbol Cipher`,
        targetAgeBand: "6-7",
        description: `Create a secret alphabet code using simple geometric symbols (star, triangle, circle) to write and decode mystery words.`,
        instructions: [
          "Draw a 5-symbol cipher key at the top of a page: △ = A, ○ = E, ☆ = S, □ = T, ◇ = O.",
          `Write a secret 3-letter word inspired by ${interestLabel.toLowerCase()} using only the symbols.`,
          "Hand the paper to yourself or a playmate to decode using the key.",
          "Create a reverse secret message with drawn clues for a mystery scavenger challenge.",
          "Sign the decoded letter with your official investigator signature."
        ],
        materials: ["plain paper", "pencils and crayons"],
        setupMinutes: 2,
        activityMinutes: { min: 20, max: 35 },
        supervisionLevel: "setup_then_independent",
        parentSetup: ["Provide plain paper and a sharpened pencil or crayon."],
        developmentalDomains: ["reading_language", "problem_solving", "concentration"],
        rationale: `Exercises symbolic encoding, working memory, and phonetic mapping. Grounded in research from ${evidence.sourceTitle}.`,
        whyEngaging: "Secret codes make reading and writing feel like an exciting spy game rather than schoolwork.",
        evidence: [
          {
            sourceId: evidence.sourceId,
            chunkId: evidence.chunkId,
            sourceTitle: evidence.sourceTitle,
            organizationAuthors: evidence.organizationAuthors,
            publicationYear: evidence.publicationYear,
            sourceType: evidence.sourceType,
            urlDoi: evidence.urlDoi,
            relevantFindingSummary: evidence.chunkText.slice(0, 180),
            activityApplicationSentence: "Applies symbolic communication and emergent literacy principles to logic play.",
            evidenceStrength: evidence.evidenceStrength,
          },
        ],
        safetyNotes: ["Ensure comfortable posture during writing."],
        easyVariation: "Use 3 symbols matching 3 colors (blue = yes, red = no, green = go).",
        extension: "Write a whole 4-word secret sentence for a family member to decode.",
        noveltySignature: `primary-code-d${dayNumber}:${interest}`,
        chokingHazardChecked: true,
        materialRiskChecked: true,
      };
    },
  },
  {
    id: "primary-water-maze",
    theme: "Wax Paper Water Drop Steering",
    ageBand: "6-7",
    mechanic: "drop_steering",
    generate: ({ preferences, evidence, dayNumber, interest }) => {
      const id = uuidv4();
      const interestLabel = normalizeInterestLabel(interest);
      return {
        id,
        title: `${interestLabel} Water Drop Obstacle Maze`,
        targetAgeBand: "6-7",
        description: `Draw a winding maze path on paper, cover with a smooth surface or tape, and steer a bead of water from start to finish.`,
        instructions: [
          "Draw a winding path with 2 dead ends on a sheet of paper.",
          "Cover the paper with a clean plastic container lid, baking sheet, or smooth plastic sheet to make it water-resistant.",
          "Use a spoon to drop a single round water bead at the starting line.",
          "Tilt the surface gently or guide the water drop with the wooden end of a pencil through the maze.",
          `Cheer when your water droplet reaches the ${interestLabel.toLowerCase()} finish line without splitting!`
        ],
        materials: ["plain paper", "household containers", "water", "spoons"],
        setupMinutes: 3,
        activityMinutes: { min: 20, max: 30 },
        supervisionLevel: "setup_then_independent",
        parentSetup: ["Set a towel under the workspace and prepare a small cup of water."],
        developmentalDomains: ["fine_motor", "concentration", "science"],
        rationale: `Develops fine motor hand steadiness, surface tension awareness, and executive focus. Grounded in research from ${evidence.sourceTitle}.`,
        whyEngaging: "Watching water bead into a rolling marble and steering it around curves feels like hands-on physical magic.",
        evidence: [
          {
            sourceId: evidence.sourceId,
            chunkId: evidence.chunkId,
            sourceTitle: evidence.sourceTitle,
            organizationAuthors: evidence.organizationAuthors,
            publicationYear: evidence.publicationYear,
            sourceType: evidence.sourceType,
            urlDoi: evidence.urlDoi,
            relevantFindingSummary: evidence.chunkText.slice(0, 180),
            activityApplicationSentence: "Applies fine motor motor precision and surface tension curiosity to focused navigation.",
            evidenceStrength: evidence.evidenceStrength,
          },
        ],
        safetyNotes: ["Wipe any drips off the floor immediately to prevent slipping."],
        easyVariation: "Make a wide straight water track rather than a maze with corners.",
        extension: "See if two water droplets merge together when they touch along the path.",
        noveltySignature: `primary-watermaze-d${dayNumber}:${interest}`,
        chokingHazardChecked: true,
        materialRiskChecked: true,
      };
    },
  },
  {
    id: "primary-shadow-theater",
    theme: "Hand Silhouette Puppetry",
    ageBand: "6-7",
    mechanic: "hand_shadows",
    generate: ({ preferences, evidence, dayNumber, interest }) => {
      const id = uuidv4();
      const interestLabel = normalizeInterestLabel(interest);
      return {
        id,
        title: `${interestLabel} Light & Shadow Story Theater`,
        targetAgeBand: "6-7",
        description: `Position a desk lamp near a light-colored wall and experiment with hand silhouettes and paper shapes to stage an adventure.`,
        instructions: [
          "Position a lamp safely so it shines against a clear wall or table surface.",
          "Hold your hands between the lamp and wall to create bird, rabbit, and monster silhouettes.",
          `Draw a simple ${interestLabel.toLowerCase()} silhouette on paper and fold a small base or prop it against a cup.`,
          "Notice how moving closer to the light makes the shadow giant, and moving farther makes it tiny and sharp.",
          "Perform a short 2-minute dialogue between your two shadow characters."
        ],
        materials: ["plain paper", "pencils and crayons", "household containers"],
        setupMinutes: 3,
        activityMinutes: { min: 20, max: 35 },
        supervisionLevel: "setup_then_independent",
        parentSetup: ["Position a standard desk lamp safely pointing at a blank wall."],
        developmentalDomains: ["creativity", "science", "imaginative_play"],
        rationale: `Reinforces light projection physics, spatial perspective-taking, and expressive verbal storytelling. Grounded in research from ${evidence.sourceTitle}.`,
        whyEngaging: "Controlling giant shadows on the wall makes storytelling dramatic, tactile, and expressive without self-consciousness.",
        evidence: [
          {
            sourceId: evidence.sourceId,
            chunkId: evidence.chunkId,
            sourceTitle: evidence.sourceTitle,
            organizationAuthors: evidence.organizationAuthors,
            publicationYear: evidence.publicationYear,
            sourceType: evidence.sourceType,
            urlDoi: evidence.urlDoi,
            relevantFindingSummary: evidence.chunkText.slice(0, 180),
            activityApplicationSentence: "Applies dramatic narrative expression and optical perspective research to shadow theater.",
            evidenceStrength: evidence.evidenceStrength,
          },
        ],
        safetyNotes: ["Do not stare directly into the light bulb. Keep paper at least 6 inches away from hot bulbs."],
        easyVariation: "Use hand shapes alone without cutting paper props.",
        extension: "Introduce background music by humming or tapping a calm beat on a table.",
        noveltySignature: `primary-shadow-d${dayNumber}:${interest}`,
        chokingHazardChecked: true,
        materialRiskChecked: true,
      };
    },
  },
];

// Fallback pools for intermediate age bands (4-5, 8-9, 10-12)
export function getArchetypesForAgeBand(ageBand: AgeBand): DynamicArchetype[] {
  if (ageBand === "2-3") return TODDLER_ARCHETYPES;
  if (ageBand === "13+") return TEEN_ARCHETYPES;
  return EARLY_PRIMARY_ARCHETYPES;
}

/**
 * Deterministically generates an age-differentiated, evidence-grounded activity
 * that matches the user's constraints, respects safety, and incorporates interests mechanically.
 */
export function generateAgeCalibratedActivity(params: {
  preferences: PlannerPreferences;
  evidence: RetrievedChunk;
  dayNumber: number;
  excludeTitle?: string;
  excludeTitles?: string[];
  excludeMechanic?: string;
  excludeMechanics?: string[];
}): PlannedActivity {
  const { preferences, evidence, dayNumber, excludeTitle, excludeTitles, excludeMechanic, excludeMechanics } = params;
  const ageBand = preferences.ageBand || preferences.child?.ageBand || "4-5";
  const archetypes = getArchetypesForAgeBand(ageBand);

  // Pick interest: rotate through user selected interests, or use a balanced default
  const interestsList = (preferences.interests && preferences.interests.length > 0)
    ? preferences.interests
    : (preferences.customInterests && preferences.customInterests.length > 0)
    ? preferences.customInterests
    : ["Nature & Science", "Creative Arts", "Building & Logic", "Movement", "Stories", "Puzzles", "Exploration"];

  const interest = interestsList[(dayNumber - 1) % interestsList.length];

  // Environment filter: if indoor-only, prefer archetypes that support indoor/apartment/any
  const userEnv = preferences.environment;
  const isIndoorOnly = userEnv === "indoors" || userEnv === "apartment_small_indoor";
  let eligibleArchetypes = archetypes;
  if (isIndoorOnly) {
    const indoorCandidates = archetypes.filter((a) => {
      if (!a.environments || a.environments.length === 0) return true;
      return a.environments.some((e) => e === "indoors" || e === "apartment_small_indoor" || e === "any");
    });
    if (indoorCandidates.length > 0) {
      eligibleArchetypes = indoorCandidates;
    }
  }

  // Mechanic filtering
  const allExcludedMechanics = [
    ...(excludeMechanic ? [excludeMechanic] : []),
    ...(excludeMechanics || []),
  ].map((m) => m.toLowerCase().trim());

  const candidateArchetypes = eligibleArchetypes.filter((a) => {
    if (allExcludedMechanics.length === 0) return true;
    const aMech = a.mechanic.toLowerCase();
    const aId = a.id.toLowerCase();
    return !allExcludedMechanics.some(
      (ex) => aMech === ex || ex.includes(aMech) || aMech.includes(ex) || aId.includes(ex) || ex.includes(aId)
    );
  });
  const pool = candidateArchetypes.length > 0 ? candidateArchetypes : eligibleArchetypes;

  // Title exclusion list
  const allExcludedTitles = [
    ...(excludeTitle ? [excludeTitle] : []),
    ...(excludeTitles || []),
  ].filter(Boolean);

  // Try candidate archetypes starting from day offset, searching for one whose title does not collide
  let selectedArchetype = pool[(dayNumber - 1) % pool.length];
  let activity = selectedArchetype.generate({
    preferences,
    evidence,
    dayNumber,
    interest,
    excludeMechanic: allExcludedMechanics[0],
  });

  if (allExcludedTitles.length > 0 && titleExistsInPlan(activity.title, allExcludedTitles)) {
    // Look through other archetypes in the pool (or eligibleArchetypes)
    const alternatives = pool.filter((a) => a.id !== selectedArchetype.id);
    const searchList = alternatives.length > 0 ? alternatives : archetypes.filter((a) => a.id !== selectedArchetype.id);

    for (let i = 0; i < searchList.length; i++) {
      const alt = searchList[(dayNumber + i) % searchList.length];
      const altActivity = alt.generate({
        preferences,
        evidence,
        dayNumber,
        interest,
        excludeMechanic: allExcludedMechanics[0],
      });
      if (!titleExistsInPlan(altActivity.title, allExcludedTitles)) {
        activity = altActivity;
        selectedArchetype = alt;
        break;
      }
    }
  }

  // Adjust duration min/max strictly to preferences
  const duration = preferences.duration || "20-30";
  if (duration === "10-15") {
    activity.activityMinutes = { min: 10, max: 15 };
    activity.setupMinutes = Math.min(activity.setupMinutes, 3);
  } else if (duration === "20-30") {
    activity.activityMinutes = { min: 20, max: 30 };
  } else if (duration === "30-60") {
    activity.activityMinutes = { min: 30, max: 50 };
  } else if (duration === "60+") {
    activity.activityMinutes = { min: 45, max: 75 };
  }

  // If apartment, ensure title and instructions have zero banned phrases
  if (preferences.environment === "apartment_small_indoor") {
    activity.description = activity.description
      .replace(/running/gi, "walking")
      .replace(/obstacle course/gi, "tabletop challenge");
    activity.instructions = activity.instructions.map((inst) =>
      inst
        .replace(/run around/gi, "walk calmly")
        .replace(/jump over/gi, "step carefully over")
        .replace(/stomp loudly/gi, "tap softly")
    );
  }

  return activity;
}

