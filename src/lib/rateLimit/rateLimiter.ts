/**
 * Application-Level Rate Limiter
 *
 * Privacy-conscious: uses hashed session ID, not raw IP.
 * Configurable per operation type via environment variables.
 *
 * Per spec sections 27C, 27D.
 */
import { createHash } from "crypto";
import { getDb, cleanExpiredRateLimitTokens } from "../db/schema";
import { AI_LIMITS } from "../config/products";

export type RateLimitOperation =
  | "chatMessages"
  | "plannerPreviews"
  | "fullPlannerGenerations"
  | "activityRegenerations";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Create a short-lived, one-way hashed identifier from the session ID.
 * Not the raw session ID — prevents correlation with stored data.
 */
function hashForRateLimit(sessionId: string): string {
  const salt = process.env.RATE_LIMIT_SALT ?? "rl-salt-dev";
  return createHash("sha256")
    .update(salt + sessionId)
    .digest("hex")
    .slice(0, 32); // Truncated — enough entropy, less than full hash
}

/**
 * Check and consume a rate limit token.
 * Returns whether the operation is allowed and how many are remaining.
 */
export function checkRateLimit(
  sessionId: string,
  operation: RateLimitOperation
): RateLimitResult {
  const db = getDb();
  const config = AI_LIMITS[operation];
  const hashedId = hashForRateLimit(sessionId);

  // Clean expired tokens periodically
  cleanExpiredRateLimitTokens();

  const windowMs = config.windowMinutes * 60 * 1000;
  const windowStart = new Date(
    Math.floor(Date.now() / windowMs) * windowMs
  ).toISOString();
  const expiresAt = new Date(
    Math.floor(Date.now() / windowMs) * windowMs + windowMs
  ).toISOString();

  // Get or create token bucket for this window
  const existing = db
    .prepare(
      `SELECT count FROM rate_limit_tokens 
       WHERE hashed_id = ? AND operation = ? AND window_start = ?`
    )
    .get(hashedId, operation, windowStart) as { count: number } | undefined;

  const currentCount = existing?.count ?? 0;

  if (currentCount >= config.max) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(
        Math.floor(Date.now() / windowMs) * windowMs + windowMs
      ),
    };
  }

  // Increment count
  if (existing) {
    db.prepare(
      `UPDATE rate_limit_tokens SET count = count + 1 
       WHERE hashed_id = ? AND operation = ? AND window_start = ?`
    ).run(hashedId, operation, windowStart);
  } else {
    db.prepare(
      `INSERT INTO rate_limit_tokens (hashed_id, operation, window_start, count, expires_at)
       VALUES (?, ?, ?, 1, ?)`
    ).run(hashedId, operation, windowStart, expiresAt);
  }

  return {
    allowed: true,
    remaining: config.max - currentCount - 1,
    resetAt: new Date(
      Math.floor(Date.now() / windowMs) * windowMs + windowMs
    ),
  };
}

/**
 * Middleware helper for API routes.
 * Returns a 429 response if rate limited, null if allowed.
 */
export function rateLimitMiddleware(
  sessionId: string,
  operation: RateLimitOperation
): { status: 429; json: { error: string; retryAfter: number } } | null {
  const result = checkRateLimit(sessionId, operation);

  if (!result.allowed) {
    const retryAfterSeconds = Math.ceil(
      (result.resetAt.getTime() - Date.now()) / 1000
    );
    return {
      status: 429,
      json: {
        error: "We're temporarily at generation capacity. Please try again shortly.",
        retryAfter: retryAfterSeconds,
      },
    };
  }

  return null;
}
