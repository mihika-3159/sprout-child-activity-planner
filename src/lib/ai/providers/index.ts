/**
 * AI Provider Index
 *
 * Registers all providers and exports the default provider selector.
 * Provider selection is driven by environment configuration.
 */
import { registerProvider, getProvider, getFallbackProvider } from "../interface";
import { GeminiProvider } from "./gemini";
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
  } else {
    console.warn("[AI] GEMINI_API_KEY not set — Gemini provider unavailable");
    if (process.env.NODE_ENV === "production") {
      console.error("[AI] Production requires at least one real AI provider");
    }
  }

  // TODO: Register Cloudflare Workers AI when credentials are available
  // registerProvider(new CloudflareProvider());
}

export { getProvider, getFallbackProvider };
export type { AIProvider, AIRequest } from "../interface";
