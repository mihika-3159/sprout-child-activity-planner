/**
 * AI Provider Index
 *
 * Registers all providers and exports the default provider selector.
 * Provider selection is driven by environment configuration.
 */
import { registerProvider, getProvider, getFallbackProvider } from "../interface";
import { GeminiProvider } from "./gemini";
import { CohereProvider } from "./cohere";
import { MockAIProvider } from "./mock";

let initialized = false;

export function initializeAIProviders(): void {
  if (initialized) return;
  initialized = true;

  // Always register mock (it guards itself against production use)
  registerProvider(new MockAIProvider());

  // Register Gemini if API key is available
  if (process.env.GEMINI_API_KEY) {
    registerProvider(new GeminiProvider());
  }

  // Register Cohere if API key is available
  if (process.env.COHERE_API_KEY) {
    registerProvider(new CohereProvider());
  }

  // Warn if no real provider is configured in production
  if (!process.env.GEMINI_API_KEY && !process.env.COHERE_API_KEY) {
    console.warn("[AI] No real AI provider API key set (GEMINI_API_KEY or COHERE_API_KEY)");
    if (process.env.NODE_ENV === "production") {
      console.error("[AI] Production requires at least one real AI provider");
    }
  }
}

export { getProvider, getFallbackProvider };
export type { AIProvider, AIRequest } from "../interface";
