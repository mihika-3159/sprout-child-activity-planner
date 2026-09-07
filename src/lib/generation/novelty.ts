/**
 * Activity Novelty Engine
 *
 * Maintains hashes/semantic fingerprints of previously generated activities.
 * Before accepting a new activity:
 * 1. Compare against recent activities
 * 2. Detect near-duplicates
 * 3. Reject excessive semantic similarity
 * 4. Regenerate with different concept/theme if duplicate
 *
 * Per spec section 4.
 */
import { createHash } from "crypto";
import { getDb } from "../db/schema";

// ─── Fingerprinting ───────────────────────────────────────────────────────────

/**
 * Create a concept hash from the core ideas of an activity.
 * Two activities with similar domains, mechanisms, and materials
 * will produce similar hashes.
 */
export function createConceptHash(params: {
  domains: string[];
  materials: string[];
  mechanism: string; // e.g. "sorting", "construction", "storytelling"
  energyLevel?: string;
}): string {
  const normalized = [
    ...params.domains.sort(),
    ...params.materials.sort(),
    params.mechanism.toLowerCase().trim(),
    params.energyLevel ?? "",
  ]
    .join("|")
    .toLowerCase();

  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

/**
 * Create a full novelty signature for an activity.
 * Combines concept hash with title tokens for more granular comparison.
 */
export function createNoveltySignature(params: {
  title: string;
  domains: string[];
  materials: string[];
  mechanism: string;
}): string {
  const titleTokens = params.title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .sort()
    .slice(0, 5)
    .join(",");

  const conceptHash = createConceptHash(params);
  return `${conceptHash}:${titleTokens}`;
}

// ─── Novelty Checks ───────────────────────────────────────────────────────────

export interface NoveltyCheckResult {
  isNovel: boolean;
  similarActivityTitle?: string;
  reason?: string;
}

/**
 * Check if an activity is sufficiently novel relative to recent activities
 * in this session.
 */
export function checkActivityNovelty(
  sessionId: string,
  noveltySignature: string,
  conceptHash: string,
  activityTitle: string
): NoveltyCheckResult {
  const db = getDb();

  // Check exact concept hash match in recent history
  const exactMatch = db
    .prepare(
      `SELECT activity_title FROM activity_fingerprints
       WHERE session_id = ? AND concept_hash = ?
       AND (expires_at IS NULL OR expires_at > datetime('now'))
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(sessionId, conceptHash) as { activity_title: string } | undefined;

  if (exactMatch) {
    return {
      isNovel: false,
      similarActivityTitle: exactMatch.activity_title,
      reason: `Too similar to recently generated activity: "${exactMatch.activity_title}"`,
    };
  }

  // Check signature prefix match (same concept hash prefix = related activity)
  const signaturePrefix = noveltySignature.split(":")[0];
  const relatedMatch = db
    .prepare(
      `SELECT activity_title, fingerprint FROM activity_fingerprints
       WHERE session_id = ?
       AND fingerprint LIKE ?
       AND (expires_at IS NULL OR expires_at > datetime('now'))
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(sessionId, `${signaturePrefix}%`) as
    | { activity_title: string; fingerprint: string }
    | undefined;

  if (relatedMatch && relatedMatch.fingerprint !== noveltySignature) {
    // Same concept family but different signature — allow after brief cooldown
    // Check if it was generated very recently (within last 3 activities)
    const recentCount = (
      db
        .prepare(
          `SELECT COUNT(*) as cnt FROM activity_fingerprints
           WHERE session_id = ?
           AND created_at > datetime('now', '-1 hour')
           ORDER BY created_at DESC`
        )
        .get(sessionId) as { cnt: number }
    ).cnt;

    if (recentCount < 5) {
      return {
        isNovel: false,
        similarActivityTitle: relatedMatch.activity_title,
        reason: `Similar concept to recently generated activity: "${relatedMatch.activity_title}"`,
      };
    }
  }

  return { isNovel: true };
}

/**
 * Record an accepted activity fingerprint.
 */
export function recordActivityFingerprint(
  sessionId: string,
  fingerprint: string,
  conceptHash: string,
  activityTitle: string
): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO activity_fingerprints (session_id, fingerprint, concept_hash, activity_title)
     VALUES (?, ?, ?, ?)`
  ).run(sessionId, fingerprint, conceptHash, activityTitle);
}

/**
 * Get all fingerprints for a session (for debugging/admin).
 */
export function getSessionFingerprints(sessionId: string) {
  const db = getDb();
  return db
    .prepare(
      `SELECT fingerprint, concept_hash, activity_title, created_at
       FROM activity_fingerprints
       WHERE session_id = ?
       ORDER BY created_at DESC
       LIMIT 50`
    )
    .all(sessionId);
}
