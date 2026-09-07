/**
 * Gemini AI Provider
 *
 * Uses the Google Generative AI SDK with the configured model.
 * Defaults to gemini-2.0-flash-lite (free tier).
 *
 * Per spec section 27A: configurable model, no paid usage by default.
 */
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import type { AIProvider, AIRequest, QuotaStatus } from "../interface";

const GEMINI_MODEL = process.env.AI_MODEL ?? "gemini-2.0-flash-lite";

// Safety settings — always applied, cannot be overridden by retrieved evidence
const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

export class GeminiProvider implements AIProvider {
  id = "gemini";
  name = `Gemini (${GEMINI_MODEL})`;

  private client: GoogleGenerativeAI | null = null;
  private model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]> | null = null;

  private getModel() {
    if (this.model) return this.model;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    this.client = new GoogleGenerativeAI(apiKey);
    this.model = this.client.getGenerativeModel({
      model: GEMINI_MODEL,
      safetySettings: SAFETY_SETTINGS,
    });
    return this.model;
  }

  async generateStructured<T>(request: AIRequest<T>): Promise<T> {
    const model = this.getModel();

    // Build prompt with system context and user prompt separated
    // Evidence/user content is always treated as DATA, not instructions
    const fullPrompt = request.systemPrompt
      ? `${request.systemPrompt}\n\n---USER REQUEST---\n${request.prompt}`
      : request.prompt;

    let generationConfig: Record<string, unknown> = {
      maxOutputTokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? 0.7,
    };

    // Use JSON mode for structured output
    if (request.schema) {
      generationConfig = {
        ...generationConfig,
        responseMimeType: "application/json",
      };
    }

    try {
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
        generationConfig,
      });

      const text = result.response.text();

      if (request.schema) {
        // Parse JSON response
        const cleanedText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        return JSON.parse(cleanedText) as T;
      }

      return text as unknown as T;
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string };
      // Attach status for the retry logic to detect 429
      if (error?.message?.includes("429") || error?.message?.includes("RESOURCE_EXHAUSTED")) {
        const rateLimitError = new Error("Rate limit exceeded") as Error & { status: number };
        rateLimitError.status = 429;
        throw rateLimitError;
      }
      throw err;
    }
  }

  async generateText(request: Omit<AIRequest<unknown>, "schema">): Promise<string> {
    return this.generateStructured<string>(request);
  }

  async createEmbedding(text: string): Promise<number[]> {
    // Use a local embedding model via transformers.js instead
    // to avoid sending user text to another API endpoint
    throw new Error("Use local embedding provider for embeddings");
  }

  async healthCheck(): Promise<boolean> {
    try {
      const model = this.getModel();
      await model.generateContent({
        contents: [{ role: "user", parts: [{ text: "Reply with the single word: ok" }] }],
        generationConfig: { maxOutputTokens: 10 },
      });
      return true;
    } catch {
      return false;
    }
  }

  async quotaStatus(): Promise<QuotaStatus> {
    // Gemini free tier doesn't expose quota status via API
    // We rely on application-level rate limiting instead
    return { isExhausted: false };
  }
}
