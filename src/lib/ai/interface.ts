/**
 * AI Provider Abstraction Layer
 *
 * Implements the AIProvider interface so the application is never
 * tightly coupled to a single model provider.
 *
 * Per spec sections 24, 27A-27H.
 */

export interface AIRequest<T> {
  prompt: string;
  systemPrompt?: string;
  schema?: Record<string, unknown>; // JSON Schema for structured output
  maxTokens?: number;
  temperature?: number;
}

export interface QuotaStatus {
  isExhausted: boolean;
  remainingRequests?: number;
  resetAt?: Date;
}

export interface AIProvider {
  id: string;
  name: string;

  generateStructured<T>(request: AIRequest<T>): Promise<T>;
  generateText(request: Omit<AIRequest<unknown>, "schema">): Promise<string>;
  createEmbedding(text: string): Promise<number[]>;
  healthCheck(): Promise<boolean>;
  quotaStatus?(): Promise<QuotaStatus>;
}

// ─── Provider Registry ────────────────────────────────────────────────────────

const registry = new Map<string, AIProvider>();

export function registerProvider(provider: AIProvider): void {
  registry.set(provider.id, provider);
}

export function getProvider(id?: string): AIProvider {
  const targetId = id ?? process.env.AI_PROVIDER ?? "gemini";
  let provider = registry.get(targetId);
  if (!provider) {
    provider = getFallbackProvider() || registry.get("mock") || registry.values().next().value;
  }
  if (!provider) {
    throw new Error(`No AI provider available (requested: "${targetId}")`);
  }
  return provider;
}

export function getFallbackProvider(): AIProvider | null {
  const fallbackId = process.env.AI_FALLBACK_PROVIDER ?? "mock";
  return registry.get(fallbackId) ?? null;
}

/**
 * Execute with automatic fallback and 429 handling.
 *
 * Flow:
 * primary request → success
 * 429 → retry with backoff → still failing → fallback provider
 * all failing → throw capacity error
 */
export async function executeWithFallback<T>(
  request: AIRequest<T>,
  operation: "structured" | "text" = "structured"
): Promise<T> {
  const primary = getProvider();
  const fallback = getFallbackProvider();

  // Check if paid usage is allowed
  if (process.env.AI_ALLOW_PAID_USAGE === "false") {
    // We'll implement quota checking per provider
  }

  try {
    return await executeWithRetry(primary, request, operation);
  } catch (err: unknown) {
    const error = err as { isCapacityError?: boolean; message?: string };
    if (error?.isCapacityError && fallback) {
      console.warn(`[AI] Primary provider capacity exceeded, trying fallback`);
      try {
        return await executeWithRetry(fallback, request, operation);
      } catch (fallbackErr) {
        throw new CapacityError("All AI providers are temporarily unavailable");
      }
    }
    throw err;
  }
}

async function executeWithRetry<T>(
  provider: AIProvider,
  request: AIRequest<T>,
  operation: "structured" | "text"
): Promise<T> {
  const MAX_RETRIES = 4;
  const BASE_DELAY_MS = 1000;
  const MAX_DELAY_MS = 30000;

  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      if (operation === "structured") {
        return await provider.generateStructured(request);
      } else {
        return (await provider.generateText(request as Omit<AIRequest<unknown>, "schema">)) as unknown as T;
      }
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string };
      lastError = err;

      if (error?.status === 429) {
        // Rate limited — exponential backoff with jitter
        const delay = Math.min(
          BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 1000,
          MAX_DELAY_MS
        );
        console.warn(`[AI] 429 from ${provider.id}, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await sleep(delay);
        continue;
      }

      // Non-retryable error
      throw err;
    }
  }

  // All retries exhausted
  const capacityError = new CapacityError(`${provider.id} rate limit not resolved after ${MAX_RETRIES} retries`);
  (capacityError as unknown as { cause: unknown }).cause = lastError;
  throw capacityError;
}

export class CapacityError extends Error {
  isCapacityError = true;
  constructor(message: string) {
    super(message);
    this.name = "CapacityError";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
