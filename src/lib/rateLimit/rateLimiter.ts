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
  try {
    const db = getDb();
    const config = AI_LIMITS[operation] || { max: 3, windowMinutes: 60 };
    const max = Number.isFinite(config.max) && config.max > 0 ? config.max : 3;
    const windowMinutes =
      Number.isFinite(config.windowMinutes) && config.windowMinutes > 0
        ? config.windowMinutes
        : 60;
    const hashedId = hashForRateLimit(sessionId);

    // Clean expired tokens periodically
    cleanExpiredRateLimitTokens();

    const windowMs = windowMinutes * 60 * 1000;
    const now = Date.now();
    const windowStartMs = Math.floor(now / windowMs) * windowMs;
    const expiresAtMs = windowStartMs + windowMs;

    const windowStart = new Date(
      Number.isFinite(windowStartMs) ? windowStartMs : now
    ).toISOString();
    const expiresAt = new Date(
      Number.isFinite(expiresAtMs) ? expiresAtMs : now + 3600000
    ).toISOString();
    const resetAt = new Date(
      Number.isFinite(expiresAtMs) ? expiresAtMs : now + 3600000
    );

    // Get or create token bucket for this window
    const existing = db
      .prepare(
        `SELECT count FROM rate_limit_tokens 
         WHERE hashed_id = ? AND operation = ? AND window_start = ?`
      )
      .get(hashedId, operation, windowStart) as { count: number } | undefined;

    const currentCount = Number(existing?.count) || 0;

    if (currentCount >= max) {
      return {
        allowed: false,
        remaining: 0,
        resetAt,
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
      remaining: Math.max(0, max - currentCount - 1),
      resetAt,
    };
  } catch (err) {
    console.warn("[RateLimiter] Rate check error, allowing request gracefully:", err);
    return {
      allowed: true,
      remaining: 1,
      resetAt: new Date(Date.now() + 3600000),
    };
  }
}

/**
 * Middleware helper for API routes.
 * Returns a 429 response if rate limited, null if allowed.
 */
export function rateLimitMiddleware(
  sessionId: string,
  operation: RateLimitOperation
): { status: 429; json: { error: string; retryAfter: number } } | null {
  try {
    const result = checkRateLimit(sessionId, operation);

    if (!result.allowed) {
      const resetTime =
        result.resetAt instanceof Date
          ? result.resetAt.getTime()
          : Date.now() + 3600000;
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((resetTime - Date.now()) / 1000)
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
  } catch (err) {
    console.warn("[RateLimitMiddleware] Exception, bypassing rate check:", err);
    return null;
  }
}
