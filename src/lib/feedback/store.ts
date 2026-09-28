import { Redis } from "@upstash/redis";
import { getDb } from "@/lib/db/schema";

export interface FeedbackRecord {
  id: number;
  session_id: string;
  rating: number;
  feedback: string;
  category: string;
  resolved: number;
  created_at: string;
}

const FEEDBACK_IDS_KEY = "sprout:user_feedback:ids";
const FEEDBACK_ITEMS_KEY = "sprout:user_feedback:items";
const FEEDBACK_COUNTER_KEY = "sprout:user_feedback:counter";
const MAX_STORED_FEEDBACK = 5000;

function getRedisConfiguration() {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

function shouldUseLocalStore() {
  return !process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME;
}

function getRedis() {
  const config = getRedisConfiguration();
  if (!config) {
    throw new Error(
      "Durable feedback storage is not configured. Connect Upstash Redis to this Vercel project and redeploy.",
    );
  }

  return new Redis(config);
}

export async function saveFeedback(input: {
  sessionId: string;
  rating: number;
  feedback: string;
  category: string;
}): Promise<FeedbackRecord> {
  if (shouldUseLocalStore()) {
    const db = getDb();
    db.prepare(`
      INSERT INTO user_feedback (session_id, rating, feedback, category)
      VALUES (?, ?, ?, ?)
    `).run(input.sessionId, input.rating, input.feedback, input.category);

    const records = db
      .prepare(
        "SELECT id, session_id, rating, feedback, category, resolved, created_at FROM user_feedback ORDER BY created_at DESC LIMIT 1",
      )
      .all() as unknown as FeedbackRecord[];
    return records[0];
  }

  const redis = getRedis();
  const id = await redis.incr(FEEDBACK_COUNTER_KEY);
  const record: FeedbackRecord = {
    id,
    session_id: input.sessionId,
    rating: input.rating,
    feedback: input.feedback,
    category: input.category,
    resolved: 0,
    created_at: new Date().toISOString(),
  };

  await redis.hset(FEEDBACK_ITEMS_KEY, { [String(id)]: record });
  await redis.lpush(FEEDBACK_IDS_KEY, id);
  await redis.ltrim(FEEDBACK_IDS_KEY, 0, MAX_STORED_FEEDBACK - 1);

  return record;
}

export async function listFeedback(limit = 200): Promise<FeedbackRecord[]> {
  if (shouldUseLocalStore()) {
    return (getDb()
      .prepare(`
        SELECT id, session_id, rating, feedback, category, resolved, created_at
        FROM user_feedback
        ORDER BY created_at DESC
        LIMIT ${Math.max(1, Math.min(500, Math.trunc(limit)))}
      `)
      .all() as unknown as FeedbackRecord[]).slice(0, Math.max(1, Math.min(500, Math.trunc(limit))));
  }

  const redis = getRedis();
  const safeLimit = Math.max(1, Math.min(500, Math.trunc(limit)));
  const ids = await redis.lrange<number>(FEEDBACK_IDS_KEY, 0, safeLimit - 1);

  const records = await Promise.all(
    ids.map((id) => redis.hget<FeedbackRecord>(FEEDBACK_ITEMS_KEY, String(id))),
  );
  return records.filter((record): record is FeedbackRecord => record !== null);
}

export async function setFeedbackResolved(id: number, resolved: boolean) {
  if (shouldUseLocalStore()) {
    getDb()
      .prepare("UPDATE user_feedback SET resolved = ? WHERE id = ?")
      .run(resolved ? 1 : 0, id);
    return;
  }

  const redis = getRedis();
  const record = await redis.hget<FeedbackRecord>(
    FEEDBACK_ITEMS_KEY,
    String(id),
  );
  if (!record) {
    throw new Error("Feedback entry not found");
  }

  await redis.hset(FEEDBACK_ITEMS_KEY, {
    [String(id)]: { ...record, resolved: resolved ? 1 : 0 },
  });
}
