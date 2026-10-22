import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { SproutDatabase } from "@/lib/db/schema";

const testDirectories: string[] = [];

function isolatedDatabase(): SproutDatabase {
  const dir = mkdtempSync(path.join(tmpdir(), "sprout-session-isolation-"));
  testDirectories.push(dir);
  const dbPath = path.join(dir, "store.json");
  // Avoid seeding this test with the project's bundled application database.
  writeFileSync(dbPath, "{}", "utf8");
  return new SproutDatabase(dbPath);
}

function seedGeneration(db: SproutDatabase, id: string, owner: string) {
  db.prepare(
    "INSERT INTO planner_generations (id, session_id, product_type, status, preferences) VALUES (?, ?, ?, ?, ?)"
  ).run(id, owner, "weekly", "complete", "{}");
}

function seedActivity(db: SproutDatabase, id: string, generationId: string) {
  db.prepare(
    "INSERT INTO planner_activities (id, generation_id, day_number, activity_index, activity_data, novelty_signature) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, generationId, 1, 0, "{}", id);
}

afterEach(() => {
  while (testDirectories.length) rmSync(testDirectories.pop()!, { recursive: true, force: true });
});

describe("Sprout session isolation", () => {
  it("never returns a planner to a different session, even when its ID is known", () => {
    const db = isolatedDatabase();
    seedGeneration(db, "gen-a", "family-a");
    seedGeneration(db, "gen-b", "family-b");

    const sql = "SELECT * FROM planner_generations WHERE id = ? AND session_id = ?";
    expect(db.prepare(sql).get("gen-a", "family-a")?.id).toBe("gen-a");
    expect(db.prepare(sql).get("gen-a", "family-b")).toBeUndefined();
    expect(db.prepare(sql).get("gen-b", "family-a")).toBeUndefined();
    expect(db.prepare(sql).get("missing", "family-a")).toBeUndefined();
  });

  it("filters session planner history rather than exposing all families' entries", () => {
    const db = isolatedDatabase();
    seedGeneration(db, "gen-a", "family-a");
    seedGeneration(db, "gen-b", "family-b");

    const rows = db.prepare("SELECT * FROM planner_generations WHERE session_id = ? ORDER BY created_at DESC").all("family-a");
    expect(rows.map((generation) => generation.id)).toEqual(["gen-a"]);
  });

  it("clears only the requesting family's activities and generations", () => {
    const db = isolatedDatabase();
    seedGeneration(db, "gen-a", "family-a");
    seedGeneration(db, "gen-b", "family-b");
    seedActivity(db, "activity-a", "gen-a");
    seedActivity(db, "activity-b", "gen-b");

    db.prepare(`DELETE FROM planner_activities
      WHERE generation_id IN (SELECT id FROM planner_generations WHERE session_id = ?)`).run("family-a");
    db.prepare("DELETE FROM planner_generations WHERE session_id = ?").run("family-a");

    expect(db.prepare("SELECT * FROM planner_activities WHERE generation_id = ?").all("gen-a")).toHaveLength(0);
    expect(db.prepare("SELECT * FROM planner_activities WHERE generation_id = ?").all("gen-b")).toHaveLength(1);
    expect(db.prepare("SELECT * FROM planner_generations WHERE id = ?").get("gen-a")).toBeUndefined();
    expect(db.prepare("SELECT * FROM planner_generations WHERE id = ?").get("gen-b")?.session_id).toBe("family-b");
  });
});
