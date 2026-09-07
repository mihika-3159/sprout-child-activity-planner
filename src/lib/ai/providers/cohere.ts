/**
 * Cohere AI Provider
 *
 * Uses the Cohere V2 Chat API with Command R models.
 * Free trial tier: 1,000 calls/month, 20 RPM.
 *
 * Supports structured JSON output via response_format.
 */
import { CohereClientV2 } from "cohere-ai";
import type { AIProvider, AIRequest, QuotaStatus } from "../interface";

const COHERE_MODEL = process.env.AI_MODEL ?? "command-r";

export class CohereProvider implements AIProvider {
  id = "cohere";
  name = `Cohere (${COHERE_MODEL})`;

  private client: CohereClientV2 | null = null;

  private getClient(): CohereClientV2 {
    if (this.client) return this.client;

    const apiKey = process.env.COHERE_API_KEY;
    if (!apiKey) {
      throw new Error("COHERE_API_KEY not configured");
    }

    this.client = new CohereClientV2({ token: apiKey });
    return this.client;
  }

  async generateStructured<T>(request: AIRequest<T>): Promise<T> {
    const client = this.getClient();

    const messages: Array<{ role: "system" | "user"; content: string }> = [];

    if (request.systemPrompt) {
      messages.push({ role: "system", content: request.systemPrompt });
    }

    messages.push({ role: "user", content: request.prompt });

    try {
      const chatRequest: Record<string, unknown> = {
        model: COHERE_MODEL,
        messages,
        maxTokens: request.maxTokens ?? 4096,
        temperature: request.temperature ?? 0.7,
      };

      // Use JSON mode for structured output
      if (request.schema) {
        chatRequest.responseFormat = {
          type: "json_object" as const,
          schema: request.schema,
        };
      }

      const response = await client.chat(chatRequest as unknown as Parameters<typeof client.chat>[0]);

      // Extract text from response
      const content = response.message?.content;
      let text = "";

      if (Array.isArray(content)) {
        text = content
          .filter((block): block is { type: "text"; text: string } => block.type === "text")
          .map((block) => block.text)
          .join("");
      } else if (typeof content === "string") {
        text = content;
      }

      if (request.schema) {
        const cleanedText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        return JSON.parse(cleanedText) as T;
      }

      return text as unknown as T;
    } catch (err: unknown) {
      const error = err as { status?: number; statusCode?: number; message?: string; body?: string };
      // Detect rate limiting
      if (
        error?.status === 429 ||
        error?.statusCode === 429 ||
        error?.message?.includes("429") ||
        error?.message?.includes("rate")
      ) {
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
    // Use local embedding provider to avoid sending user text to another API
    throw new Error("Use local embedding provider for embeddings");
  }

  async healthCheck(): Promise<boolean> {
    try {
      const client = this.getClient();
      await client.chat({
        model: COHERE_MODEL,
        messages: [{ role: "user", content: "Reply with the single word: ok" }],
        maxTokens: 10,
      } as Parameters<typeof client.chat>[0]);
      return true;
    } catch {
      return false;
    }
  }

  async quotaStatus(): Promise<QuotaStatus> {
    // Cohere free trial doesn't expose quota status via API
    return { isExhausted: false };
  }
}
