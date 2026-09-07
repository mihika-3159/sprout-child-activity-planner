/**
 * Mock AI Provider — Development Only
 *
 * CRITICAL: This provider MUST NEVER be used in production.
 * It returns clearly-labeled TEST FIXTURE data.
 *
 * Per spec section 35: synthetic evidence is only for tests and local demo fixtures.
 */
import type { AIProvider, AIRequest, QuotaStatus } from "../interface";

const MOCK_WARNING = "TEST FIXTURE — NOT PRODUCTION EVIDENCE";

export class MockAIProvider implements AIProvider {
  id = "mock";
  name = "Mock Provider (Development Only)";

  private assertDevMode(): void {
    if (process.env.NODE_ENV === "production") {
      throw new Error("MockAIProvider MUST NOT be used in production");
    }
  }

  async generateStructured<T>(request: AIRequest<T>): Promise<T> {
    this.assertDevMode();

    console.log(`[MockAI] ${MOCK_WARNING}`);
    console.log(`[MockAI] Would send prompt (${request.prompt.length} chars) to AI`);

    // Return a mock PlannedActivity-like structure
    const mockActivity = {
      id: "mock-" + Date.now(),
      title: "🧪 TEST: Paper Shape Sorting",
      targetAgeBand: "4-5",
      description: `${MOCK_WARNING} — This is a test fixture activity, not real AI output.`,
      instructions: [
        "Cut paper into different shapes",
        "Sort them by colour or shape",
        "Count how many of each type",
      ],
      materials: ["paper", "pencils_crayons", "child_safe_scissors"],
      setupMinutes: 2,
      activityMinutes: { min: 10, max: 20 },
      supervisionLevel: "setup_then_independent",
      parentSetup: ["Cut shapes beforehand for younger children"],
      developmentalDomains: ["fine_motor", "numeracy"],
      rationale: `${MOCK_WARNING} — In production this would cite approved evidence.`,
      evidence: [{
        sourceIds: ["test-fixture"],
        chunkIds: ["test-chunk-1"],
        supportExplanation: `${MOCK_WARNING}`,
      }],
      safetyNotes: [],
      easyVariation: "Use stickers instead of cutting",
      extension: "Create a pattern sequence",
      noveltySignature: `mock-${Date.now()}`,
      evidenceSupport: {
        evidenceChunkIds: ["test-chunk-1"],
        supportedDomains: ["fine_motor"],
        evidenceStrength: "limited" as const,
        claimsAllowed: [`${MOCK_WARNING}`],
      },
    };

    // If schema provided, try to return something that matches the expected shape
    return mockActivity as unknown as T;
  }

  async generateText(request: Omit<AIRequest<unknown>, "schema">): Promise<string> {
    this.assertDevMode();
    return `${MOCK_WARNING}\n\nThis is a mock response for development. Configure GEMINI_API_KEY to use real AI generation.\n\nOriginal prompt length: ${request.prompt.length} characters.`;
  }

  async createEmbedding(text: string): Promise<number[]> {
    this.assertDevMode();
    // Return a deterministic fake embedding (384 dimensions like all-MiniLM-L6-v2)
    const hash = Array.from(text).reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return Array.from({ length: 384 }, (_, i) => Math.sin((hash + i) * 0.1) * 0.5);
  }

  async healthCheck(): Promise<boolean> {
    this.assertDevMode();
    return true;
  }

  async quotaStatus(): Promise<QuotaStatus> {
    return { isExhausted: false };
  }
}
