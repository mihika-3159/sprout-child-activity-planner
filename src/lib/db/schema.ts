/**
 * Sprout Storage Engine
 *
 * Lightweight, zero-native-compilation storage layer.
 * Provides standard SQL/Prepared-Statement style interface:
 * prepare(sql).run(...), prepare(sql).get(...), prepare(sql).all(...)
 *
 * Automatically persists to disk in ./data/app_store.json in development,
 * and runs seamlessly in serverless and test environments.
 */
import path from "path";
import fs from "fs";

interface TableStore {
  anonymous_sessions: Record<string, Record<string, unknown>>;
  rate_limit_tokens: Array<Record<string, unknown>>;
  evidence_sources: Record<string, Record<string, unknown>>;
  evidence_chunks: Record<string, Record<string, unknown>>;
  planner_generations: Record<string, Record<string, unknown>>;
  planner_activities: Record<string, Record<string, unknown>>;
  activity_fingerprints: Array<Record<string, unknown>>;
  purchase_entitlements: Record<string, Record<string, unknown>>;
  generation_audits: Array<Record<string, unknown>>;
  analytics_events: Array<Record<string, unknown>>;
  user_feedback: Array<Record<string, unknown>>;
}

class SproutDatabase {
  private store: TableStore;
  private filePath: string;

  constructor(filePath?: string) {
    const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    const defaultServerlessPath = path.join("/tmp", "app_store.json");
    const defaultLocalPath = path.resolve(process.cwd(), "./data/app_store.json");

    this.filePath = filePath || process.env.DATABASE_PATH || (isServerless ? defaultServerlessPath : defaultLocalPath);
    this.store = {
      anonymous_sessions: {},
      rate_limit_tokens: [],
      evidence_sources: {},
      evidence_chunks: {},
      planner_generations: {},
      planner_activities: {},
      activity_fingerprints: [],
      purchase_entitlements: {},
      generation_audits: [],
      analytics_events: [],
      user_feedback: [],
    };
    this.loadFromDisk();
  }

  private lastMtime: number = 0;

  private loadFromDisk() {
    try {
      if (fs.existsSync(this.filePath)) {
        const stats = fs.statSync(this.filePath);
        if (stats.mtimeMs > this.lastMtime) {
          const data = fs.readFileSync(this.filePath, "utf-8");
          const parsed = JSON.parse(data);
          this.store = { ...this.store, ...parsed };
          this.lastMtime = stats.mtimeMs;
        }
      } else {
        // If writable location does not exist yet (e.g., in /tmp on serverless), seed from bundled ./data/app_store.json
        const seedPath = path.resolve(process.cwd(), "./data/app_store.json");
        if (fs.existsSync(seedPath)) {
          const seedData = fs.readFileSync(seedPath, "utf-8");
          const parsed = JSON.parse(seedData);
          this.store = { ...this.store, ...parsed };
          this.saveToDisk();
        }
      }
    } catch {
      // Start with empty store if file not found or malformed
    }
  }

  private saveToDisk() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.store, null, 2), "utf-8");
      if (fs.existsSync(this.filePath)) {
        this.lastMtime = fs.statSync(this.filePath).mtimeMs;
      }
    } catch {
      // Ignore disk write errors in ephemeral environments
    }
  }

  pragma(_sql: string) {
    // No-op for compatibility
  }

  exec(_sql: string) {
    // No-op for schema initialization compatibility
  }

  prepare(sql: string) {
    const trimmed = sql.trim();
    const self = this;

    return {
      run(...params: unknown[]) {
        self.loadFromDisk();
        self.executeStatement(trimmed, params);
        self.saveToDisk();
        return { changes: 1, lastInsertRowid: Date.now() };
      },

      get(...params: unknown[]): Record<string, unknown> | undefined {
        self.loadFromDisk();
        const results = self.queryStatement(trimmed, params);
        return results[0];
      },

      all(...params: unknown[]): Array<Record<string, unknown>> {
        self.loadFromDisk();
        return self.queryStatement(trimmed, params);
      },
    };
  }

  private executeStatement(sql: string, params: unknown[]) {
    const lower = sql.toLowerCase().replace(/\s+/g, " ");

    // ─── INSERT INTO anonymous_sessions ─────────────────────────
    if (lower.includes("insert into anonymous_sessions") || lower.includes("insert or replace into anonymous_sessions")) {
      const id = String(params[0]);
      const prefData = params[1] as string;
      this.store.anonymous_sessions[id] = {
        id,
        preference_data: prefData,
        created_at: new Date().toISOString(),
        last_seen: new Date().toISOString(),
      };
      return;
    }

    // ─── INSERT INTO rate_limit_tokens ──────────────────────────
    if (lower.includes("insert into rate_limit_tokens")) {
      this.store.rate_limit_tokens.push({
        hashed_id: params[0],
        operation: params[1],
        window_start: params[2],
        count: Number(params[3]) || 1,
        expires_at: params[4] || new Date(Date.now() + 3600000).toISOString(),
      });
      return;
    }

    // ─── UPDATE rate_limit_tokens ───────────────────────────────
    if (lower.includes("update rate_limit_tokens")) {
      const entry = this.store.rate_limit_tokens.find(
        (t) => t.hashed_id === params[0] && t.operation === params[1] && t.window_start === params[2]
      );
      if (entry) {
        entry.count = (Number(entry.count) || 0) + 1;
      }
      return;
    }

    // ─── INSERT INTO evidence_sources ───────────────────────────
    if (lower.includes("insert into evidence_sources")) {
      const id = String(params[0]);
      this.store.evidence_sources[id] = {
        id,
        source_name: params[1],
        source_url: params[2],
        terms_url: params[3],
        license: params[4],
        commercial_reuse_allowed: params[5],
        automated_retrieval_allowed: params[6],
        parent_can_access_free: params[7],
        retrieval_method: params[8],
        api_endpoint: params[9],
        attribution_required: params[10],
        attribution_text: params[11],
        last_rights_check: params[12],
        rights_check_notes: params[13],
        review_status: params[14] || "approved",
        reviewer_notes: params[15],
        created_at: new Date().toISOString(),
      };
      return;
    }

    // ─── INSERT INTO evidence_chunks ────────────────────────────
    if (lower.includes("insert into evidence_chunks")) {
      const id = String(params[0]);
      this.store.evidence_chunks[id] = {
        id,
        source_id: params[1],
        chunk_text: params[2],
        chunk_index: params[3],
        source_title: params[4],
        organization_authors: params[5],
        publication_year: params[6],
        source_type: params[7],
        url_doi: params[8],
        free_access_url: params[9],
        age_range_min: params[10],
        age_range_max: params[11],
        developmental_domains: params[12],
        activity_categories: params[13],
        supervision_considerations: params[14],
        safety_considerations: params[15],
        evidence_strength: params[16],
        approval_status: params[17] || "approved",
        embedding: params[18],
        embedding_dimensions: params[19],
        created_at: new Date().toISOString(),
      };
      return;
    }

    // ─── UPDATE evidence_chunks ─────────────────────────────────
    if (lower.includes("update evidence_chunks set approval_status")) {
      const status = params[0] as string;
      const chunkId = params[1] as string;
      if (this.store.evidence_chunks[chunkId]) {
        this.store.evidence_chunks[chunkId].approval_status = status;
      }
      return;
    }

    // ─── INSERT INTO planner_generations ────────────────────────
    if (lower.includes("insert into planner_generations")) {
      const id = String(params[0]);
      const sessionId = String(params[1]);
      let productType = "weekly";
      let status = "generating";
      let preferences = "";

      if (params.length === 3) {
        preferences = params[2] as string;
        if (lower.includes("'monthly'")) productType = "monthly";
        else if (lower.includes("'yearly'")) productType = "yearly";
      } else {
        productType = (params[2] as string) || "weekly";
        status = (params[3] as string) || "generating";
        preferences = params[4] as string;
      }

      this.store.planner_generations[id] = {
        id,
        session_id: sessionId,
        product_type: productType,
        status,
        preferences,
        created_at: new Date().toISOString(),
      };
      return;
    }

    // ─── UPDATE planner_generations ─────────────────────────────
    if (lower.includes("update planner_generations")) {
      if (lower.includes("set status = 'preview_ready'")) {
        const preview = params[0] as string;
        const full = params[1] as string;
        const id = params[2] as string;
        if (!this.store.planner_generations[id]) {
          this.store.planner_generations[id] = { id };
        }
        this.store.planner_generations[id].status = "preview_ready";
        this.store.planner_generations[id].preview_data = preview;
        this.store.planner_generations[id].full_data = full;
      } else if (lower.includes("set full_data = ?")) {
        const full = params[0] as string;
        const id = params[1] as string;
        if (!this.store.planner_generations[id]) {
          this.store.planner_generations[id] = { id };
        }
        this.store.planner_generations[id].full_data = full;
      } else if (lower.includes("set status = ?")) {
        // Generic status update (e.g. generating_week_N)
        const status = params[0] as string;
        const id = params[1] as string;
        if (this.store.planner_generations[id]) {
          this.store.planner_generations[id].status = status;
        }
      }
      return;
    }

    // ─── INSERT INTO planner_activities ─────────────────────────
    if (lower.includes("insert into planner_activities") || lower.includes("insert or replace into planner_activities")) {
      const id = String(params[0]);
      // Monthly: (id, generation_id, week_number, day_number, activity_index, activity_data, novelty_signature) = 7 params
      // Weekly:  (id, generation_id, day_number, activity_index, activity_data, novelty_signature) = 6 params
      const isMonthly = params.length >= 7;
      const generationId = String(params[1]);
      const weekNumber = isMonthly ? Number(params[2]) : null;
      const dayNumber = isMonthly ? Number(params[3]) : Number(params[2]);
      const activityIndex = isMonthly ? Number(params[4]) : Number(params[3]);
      const activityData = isMonthly ? (params[5] as string) : (params[4] as string);
      const noveltySignature = isMonthly ? (params[6] as string) : (params[5] as string);

      this.store.planner_activities[id] = {
        id,
        generation_id: generationId,
        week_number: weekNumber,
        day_number: dayNumber,
        activity_index: activityIndex,
        activity_data: activityData,
        novelty_signature: noveltySignature,
        created_at: new Date().toISOString(),
      };
      return;
    }

    // ─── INSERT INTO activity_fingerprints ───────────────────────
    if (lower.includes("insert into activity_fingerprints")) {
      this.store.activity_fingerprints.push({
        session_id: params[0],
        fingerprint: params[1],
        concept_hash: params[2],
        activity_title: params[3],
        created_at: new Date().toISOString(),
      });
      return;
    }

    // ─── INSERT INTO purchase_entitlements ───────────────────────
    if (lower.includes("insert into purchase_entitlements")) {
      const id = String(params[0]);
      this.store.purchase_entitlements[id] = {
        id,
        session_id: params[1],
        generation_id: params[2],
        provider_transaction_id: params[3],
        product_type: params[4],
        payment_status: params[5],
        purchase_timestamp: new Date().toISOString(),
      };
      return;
    }

    // ─── INSERT INTO generation_audits ───────────────────────────
    if (lower.includes("insert into generation_audits")) {
      this.store.generation_audits.push({
        id: this.store.generation_audits.length + 1,
        activity_id: params[0],
        session_id: params[1],
        anonymized_preferences: params[2],
        retrieved_chunk_ids: params[3],
        evidence_scores: params[4],
        safety_classification: params[5],
        grounding_validation_result: params[6],
        rejection_reason: params[7],
        created_at: new Date().toISOString(),
      });
      return;
    }

    // ─── INSERT INTO analytics_events ────────────────────────────
    if (lower.includes("insert into analytics_events")) {
      this.store.analytics_events.push({
        event_type: params[0],
        product_type: params[1],
        created_at: new Date().toISOString(),
      });
      return;
    }

    // ─── INSERT INTO user_feedback ───────────────────────────────
    if (lower.includes("insert into user_feedback")) {
      if (!this.store.user_feedback) this.store.user_feedback = [];
      this.store.user_feedback.push({
        id: (this.store.user_feedback.length || 0) + 1,
        session_id: params[0],
        rating: params[1],
        feedback: params[2],
        category: params[3] || "general",
        resolved: 0,
        created_at: new Date().toISOString(),
      });
      return;
    }

    // ─── UPDATE user_feedback (resolved) ─────────────────────────
    if (lower.includes("update user_feedback")) {
      if (!this.store.user_feedback) this.store.user_feedback = [];
      const feedbackId = Number(params[params.length - 1]);
      const entry = this.store.user_feedback.find((f) => f.id === feedbackId);
      if (entry) {
        if (lower.includes("set resolved = 1")) {
          entry.resolved = 1;
        } else if (lower.includes("set resolved = 0")) {
          entry.resolved = 0;
        } else if (lower.includes("set resolved = ?") || lower.includes("set resolved =")) {
          entry.resolved = Number(params[0]);
        }
      }
      return;
    }

    // ─── DELETE / CLEAR SESSION ─────────────────────────────────
    if (lower.includes("delete from")) {
      if (lower.includes("from planner_activities")) {
        this.store.planner_activities = {};
      } else if (lower.includes("from planner_generations")) {
        const sid = params[0] as string;
        Object.keys(this.store.planner_generations).forEach((gid) => {
          if (this.store.planner_generations[gid].session_id === sid) {
            delete this.store.planner_generations[gid];
          }
        });
      } else if (lower.includes("from activity_fingerprints")) {
        const sid = params[0] as string;
        this.store.activity_fingerprints = this.store.activity_fingerprints.filter((f) => f.session_id !== sid);
      } else if (lower.includes("from anonymous_sessions")) {
        const sid = params[0] as string;
        delete this.store.anonymous_sessions[sid];
      }
      return;
    }
  }

  private queryStatement(sql: string, params: unknown[]): Array<Record<string, unknown>> {
    const lower = sql.toLowerCase().replace(/\s+/g, " ");

    // ─── SELECT FROM evidence_chunks ─────────────────────────────
    if (lower.includes("from evidence_chunks")) {
      const chunks = Object.values(this.store.evidence_chunks);
      const sources = this.store.evidence_sources;

      return chunks.map((c) => {
        const source = sources[String(c.source_id)] || {};
        return {
          chunkId: c.id,
          sourceId: c.source_id,
          chunkText: c.chunk_text,
          sourceTitle: c.source_title,
          organizationAuthors: c.organization_authors,
          publicationYear: c.publication_year,
          sourceType: c.source_type,
          urlDoi: c.url_doi,
          freeAccessUrl: c.free_access_url,
          ageMin: c.age_range_min,
          ageMax: c.age_range_max,
          developmentalDomains: c.developmental_domains,
          activityCategories: c.activity_categories,
          supervisionConsiderations: c.supervision_considerations,
          safetyConsiderations: c.safety_considerations,
          evidenceStrength: c.evidence_strength,
          embeddingBlob: c.embedding,
          license: source.license || "CC_BY",
          approval_status: c.approval_status || "approved",
          source_title: c.source_title,
          created_at: c.created_at,
        };
      });
    }

    // ─── SELECT FROM evidence_sources ────────────────────────────
    if (lower.includes("from evidence_sources")) {
      if (lower.includes("count(*)")) {
        return [{ count: Object.keys(this.store.evidence_sources).length }];
      }
      return Object.values(this.store.evidence_sources);
    }

    // ─── SELECT FROM rate_limit_tokens ───────────────────────────
    if (lower.includes("from rate_limit_tokens")) {
      const hashedId = params[0] as string;
      const op = params[1] as string;
      const ws = params[2] as string;
      const entry = this.store.rate_limit_tokens.find(
        (t) => t.hashed_id === hashedId && t.operation === op && t.window_start === ws
      );
      return entry ? [entry] : [];
    }

    // ─── SELECT FROM activity_fingerprints ───────────────────────
    if (lower.includes("from activity_fingerprints")) {
      const sid = params[0] as string;
      const conceptHash = params[1] as string;
      const matches = this.store.activity_fingerprints.filter(
        (f) => f.session_id === sid && (!conceptHash || f.concept_hash === conceptHash)
      );
      return matches;
    }

    // ─── SELECT FROM planner_generations ─────────────────────────
    if (lower.includes("from planner_generations")) {
      const allGens = Object.values(this.store.planner_generations);
      if (lower.includes("where session_id = ?") && !lower.includes("id = ?")) {
        const sid = params[0] as string;
        return allGens.filter((g) => g.session_id === sid);
      }
      if (lower.includes("where id = ? and session_id = ?")) {
        const id = String(params[0]);
        const sid = String(params[1]);
        const gen = this.store.planner_generations[id];
        if (gen && (!gen.session_id || gen.session_id === sid)) {
          return [gen];
        }
        const found = allGens.find((g) => g.id === id && (!g.session_id || g.session_id === sid));
        return found ? [found] : (gen ? [gen] : []);
      }
      if (lower.includes("where id = ?")) {
        const id = params[0] as string;
        const gen = this.store.planner_generations[id];
        return gen ? [gen] : [];
      }
      return allGens;
    }

    // ─── SELECT FROM planner_activities ──────────────────────────
    if (lower.includes("from planner_activities")) {
      const genId = params[0] as string;
      const allActs = Object.values(this.store.planner_activities).filter(
        (a) => a.generation_id === genId
      );
      // DISTINCT week_number query
      if (lower.includes("distinct week_number")) {
        const weekNums = [...new Set(allActs.map((a) => a.week_number))].filter((w) => w !== null && w !== undefined);
        return weekNums.map((w) => ({ week_number: w }));
      }
      // Filter by week_number
      if (params.length >= 2 && !lower.includes("distinct")) {
        const weekNum = Number(params[1]);
        const weekActs = allActs
          .filter((a) => Number(a.week_number) === weekNum)
          .sort((a, b) => Number(a.day_number) - Number(b.day_number));
        return weekActs;
      }
      // All activities for generation, ordered by week then day
      return allActs.sort((a, b) => {
        const wDiff = Number(a.week_number || 0) - Number(b.week_number || 0);
        if (wDiff !== 0) return wDiff;
        return Number(a.day_number) - Number(b.day_number);
      });
    }

    // ─── SELECT FROM purchase_entitlements ───────────────────────
    if (lower.includes("from purchase_entitlements")) {
      const sid = params[0] as string;
      const gid = params[1] as string;
      const entitlements = Object.values(this.store.purchase_entitlements).filter(
        (e) => e.session_id === sid && (!gid || e.generation_id === gid) && e.payment_status === "paid"
      );
      return entitlements;
    }

    // ─── SELECT FROM generation_audits ───────────────────────────
    if (lower.includes("from generation_audits")) {
      return [...this.store.generation_audits].reverse();
    }

    // ─── SELECT FROM user_feedback ───────────────────────────────
    if (lower.includes("from user_feedback")) {
      if (!this.store.user_feedback) return [];
      // Return sorted newest-first
      return [...this.store.user_feedback].reverse();
    }

    // ─── SELECT FROM analytics_events ────────────────────────────
    if (lower.includes("from analytics_events")) {
      const counts: Record<string, number> = {};
      this.store.analytics_events.forEach((ev) => {
        const type = String(ev.event_type);
        counts[type] = (counts[type] || 0) + 1;
      });
      return Object.entries(counts).map(([event_type, count]) => ({ event_type, count }));
    }

    return [];
  }
}

let _db: SproutDatabase | null = null;

export function getDb(): SproutDatabase {
  if (!_db) {
    _db = new SproutDatabase();
  }
  return _db;
}

export function cleanExpiredRateLimitTokens() {
  // No-op
}

export default getDb;
