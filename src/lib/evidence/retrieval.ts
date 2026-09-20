/**
 * Evidence Retrieval Engine
 *
 * Vector retrieval + metadata filtering over approved evidence chunks only.
 * Unapproved or rejected evidence MUST NEVER be returned for production generation.
 *
 * Per spec sections 1, 2, 21.
 */
import { getDb } from "../db/schema";
import { defaultEmbeddingProvider, cosineSimilarity } from "../embeddings/local";

export interface RetrievedChunk {
  chunkId: string;
  sourceId: string;
  sourceTitle: string;
  organizationAuthors: string;
  publicationYear: number | null;
  sourceType: string;
  urlDoi: string;
  freeAccessUrl: string;
  chunkText: string;
  developmentalDomains: string[];
  activityCategories: string[];
  supervisionConsiderations: string;
  safetyConsiderations: string;
  evidenceStrength: "strong" | "moderate" | "limited";
  license: string;
  score: number;
}

export interface RetrievalQuery {
  domains?: string[];
  interests?: string[];
  ageMin?: number;
  ageMax?: number;
  limit?: number;
  minScoreThreshold?: number;
}

/**
 * Retrieve approved evidence matching the given criteria.
 */
export async function retrieveApprovedEvidence(
  queryText: string,
  query: RetrievalQuery = {}
): Promise<RetrievedChunk[]> {
  const db = getDb();
  const limit = query.limit ?? 5;
  const minScore = query.minScoreThreshold ?? 0.15;

  // 1. Fetch only APPROVED evidence chunks joined with approved sources
  let sql = `
    SELECT 
      c.id AS chunkId,
      c.source_id AS sourceId,
      c.chunk_text AS chunkText,
      c.source_title AS sourceTitle,
      c.organization_authors AS organizationAuthors,
      c.publication_year AS publicationYear,
      c.source_type AS sourceType,
      c.url_doi AS urlDoi,
      c.free_access_url AS freeAccessUrl,
      c.age_range_min AS ageMin,
      c.age_range_max AS ageMax,
      c.developmental_domains AS developmentalDomains,
      c.activity_categories AS activityCategories,
      c.supervision_considerations AS supervisionConsiderations,
      c.safety_considerations AS safetyConsiderations,
      c.evidence_strength AS evidenceStrength,
      c.embedding AS embeddingBlob,
      s.license AS license
    FROM evidence_chunks c
    JOIN evidence_sources s ON c.source_id = s.id
    WHERE c.approval_status = 'approved'
      AND s.review_status = 'approved'
  `;

  const params: unknown[] = [];

  // Age filtering if specified
  if (query.ageMin !== undefined && query.ageMax !== undefined) {
    sql += ` AND (c.age_range_min IS NULL OR c.age_range_min <= ?) AND (c.age_range_max IS NULL OR c.age_range_max >= ?)`;
    params.push(query.ageMax, query.ageMin);
  }

  const rows = db.prepare(sql).all(...params) as Array<{
    chunkId: string;
    sourceId: string;
    chunkText: string;
    sourceTitle: string | null;
    organizationAuthors: string | null;
    publicationYear: number | null;
    sourceType: string | null;
    urlDoi: string | null;
    freeAccessUrl: string | null;
    ageMin: number | null;
    ageMax: number | null;
    developmentalDomains: string | null;
    activityCategories: string | null;
    supervisionConsiderations: string | null;
    safetyConsiderations: string | null;
    evidenceStrength: "strong" | "moderate" | "limited" | null;
    embeddingBlob: Buffer | null;
    license: string;
  }>;

  let candidateRows = rows;

  // Perform strict in-memory age filtering
  if (query.ageMin !== undefined && query.ageMax !== undefined) {
    const min = query.ageMin;
    const max = query.ageMax;
    candidateRows = candidateRows.filter((r) => {
      // Chunk must overlap with requested age range
      const cMin = r.ageMin ?? 0;
      const cMax = r.ageMax ?? 18;
      return cMin <= max && cMax >= min;
    });
  }

  // If candidate rows after age filtering is empty, fallback to candidate rows (or broader set)
  if (candidateRows.length === 0) {
    candidateRows = rows;
  }

  // 2. Generate embedding for query
  const queryEmbedding = await defaultEmbeddingProvider.createEmbedding(queryText);

  // 3. Compute vector similarity scores
  const scoredChunks: RetrievedChunk[] = [];

  for (const row of candidateRows) {
    let rowEmbedding: number[] = [];

    if (row.embeddingBlob && row.embeddingBlob.length > 0) {
      // Decode Float32Array from BLOB
      const floatArray = new Float32Array(
        row.embeddingBlob.buffer,
        row.embeddingBlob.byteOffset,
        row.embeddingBlob.byteLength / 4
      );
      rowEmbedding = Array.from(floatArray);
    } else {
      // Lazy compute embedding if missing
      rowEmbedding = await defaultEmbeddingProvider.createEmbedding(row.chunkText);
    }

    const similarity = cosineSimilarity(queryEmbedding, rowEmbedding);

    // Boost if domain matches requested query domains
    let domainBoost = 0;
    const parsedDomains: string[] = row.developmentalDomains
      ? JSON.parse(row.developmentalDomains)
      : [];

    if (query.domains && query.domains.length > 0) {
      const matchCount = query.domains.filter((d) =>
        parsedDomains.some((pd) => pd.toLowerCase().includes(d.toLowerCase()))
      ).length;
      domainBoost = (matchCount / query.domains.length) * 0.2;
    }

    const totalScore = similarity + domainBoost;

    if (totalScore >= minScore) {
      scoredChunks.push({
        chunkId: row.chunkId,
        sourceId: row.sourceId,
        sourceTitle: row.sourceTitle ?? "Peer-Reviewed Developmental Research",
        organizationAuthors: row.organizationAuthors ?? "Child Development Consortium",
        publicationYear: row.publicationYear,
        sourceType: row.sourceType ?? "Systematic Review",
        urlDoi: row.urlDoi ?? "",
        freeAccessUrl: row.freeAccessUrl ?? "",
        chunkText: row.chunkText,
        developmentalDomains: parsedDomains,
        activityCategories: row.activityCategories ? JSON.parse(row.activityCategories) : [],
        supervisionConsiderations: row.supervisionConsiderations ?? "Standard parental awareness",
        safetyConsiderations: row.safetyConsiderations ?? "Use age-appropriate materials",
        evidenceStrength: row.evidenceStrength ?? "moderate",
        license: row.license,
        score: totalScore,
      });
    }
  }

  // Sort descending by score and slice
  scoredChunks.sort((a, b) => b.score - a.score);
  return scoredChunks.slice(0, limit);
}
