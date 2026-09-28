import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const redisState = vi.hoisted(() => ({
  counter: 0,
  ids: [] as number[],
  items: new Map<string, unknown>(),
}));

vi.mock("@upstash/redis", () => ({
  Redis: {
    fromEnv: () => ({
      incr: async () => ++redisState.counter,
      hset: async (_key: string, fields: Record<string, unknown>) => {
        Object.entries(fields).forEach(([id, value]) => redisState.items.set(id, value));
      },
      hget: async (_key: string, id: string) => redisState.items.get(id) ?? null,
      lpush: async (_key: string, id: number) => redisState.ids.unshift(id),
      ltrim: async (_key: string, start: number, end: number) => {
        redisState.ids = redisState.ids.slice(start, end + 1);
      },
      lrange: async (_key: string, start: number, end: number) =>
        redisState.ids.slice(start, end + 1),
    }),
  },
}));

describe("durable feedback store", () => {
  beforeEach(() => {
    redisState.counter = 0;
    redisState.ids = [];
    redisState.items.clear();
    process.env.VERCEL = "1";
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  });

  afterEach(() => {
    delete process.env.VERCEL;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("saves feedback and returns newest entries first", async () => {
    const { listFeedback, saveFeedback } = await import("@/lib/feedback/store");

    await saveFeedback({
      sessionId: "session-1",
      rating: 4,
      feedback: "First",
      category: "general",
    });
    await saveFeedback({
      sessionId: "session-2",
      rating: 5,
      feedback: "Second",
      category: "quality",
    });

    const records = await listFeedback(10);
    expect(records.map((record) => record.feedback)).toEqual(["Second", "First"]);
    expect(records[0]).toMatchObject({ id: 2, rating: 5, resolved: 0 });
  });

  it("persists resolved status in the same durable record", async () => {
    const { listFeedback, saveFeedback, setFeedbackResolved } = await import(
      "@/lib/feedback/store"
    );

    const record = await saveFeedback({
      sessionId: "session-1",
      rating: 5,
      feedback: "Useful plan",
      category: "general",
    });
    await setFeedbackResolved(record.id, true);

    expect((await listFeedback(10))[0].resolved).toBe(1);
  });

  it("fails loudly on Vercel when durable storage is not configured", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const { saveFeedback } = await import("@/lib/feedback/store");

    await expect(
      saveFeedback({
        sessionId: "session-1",
        rating: 5,
        feedback: "Test",
        category: "general",
      }),
    ).rejects.toThrow("Durable feedback storage is not configured");
  });
});
