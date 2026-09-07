import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/schema";
import { ensureEvidenceSeeded } from "@/lib/evidence/seed";
import { defaultEmbeddingProvider } from "@/lib/embeddings/local";
import { canAutoIngestForCommercialUse, EvidenceLicense } from "@/lib/evidence/license";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  await ensureEvidenceSeeded();
  const db = getDb();

  const sources = db.prepare("SELECT * FROM evidence_sources ORDER BY created_at DESC").all();
  const chunks = db
    .prepare(`
      SELECT c.*, s.source_name 
      FROM evidence_chunks c
      JOIN evidence_sources s ON c.source_id = s.id
      ORDER BY c.created_at DESC
    `)
    .all();

  return NextResponse.json({ sources, chunks });
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();

    if (body.action === "update_status") {
      const { chunkId, status } = body;
      db.prepare("UPDATE evidence_chunks SET approval_status = ?, reviewed_at = datetime('now') WHERE id = ?").run(
        status,
        chunkId
      );
      return NextResponse.json({ success: true });
    }

    if (body.action === "add_chunk") {
      const { sourceId, chunkText, sourceTitle, organizationAuthors, publicationYear, ageRangeMin, ageRangeMax, developmentalDomains, evidenceStrength } = body;
      const chunkId = uuidv4();
      const embedding = await defaultEmbeddingProvider.createEmbedding(chunkText);
      const buffer = Buffer.from(new Float32Array(embedding).buffer);

      db.prepare(`
        INSERT INTO evidence_chunks (
          id, source_id, chunk_text, chunk_index, source_title, organization_authors,
          publication_year, age_range_min, age_range_max, developmental_domains,
          evidence_strength, approval_status, embedding, embedding_dimensions
        ) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?)
      `).run(
        chunkId,
        sourceId,
        chunkText,
        sourceTitle,
        organizationAuthors,
        publicationYear || 2023,
        ageRangeMin || 3,
        ageRangeMax || 10,
        JSON.stringify(developmentalDomains || ["cognitive"]),
        evidenceStrength || "strong",
        buffer,
        defaultEmbeddingProvider.dimensions
      );

      return NextResponse.json({ success: true, chunkId });
    }

    if (body.action === "add_source") {
      const { sourceName, sourceUrl, license, retrievalMethod } = body;
      const sourceId = `src-${uuidv4().slice(0, 8)}`;
      const isAllowed = canAutoIngestForCommercialUse(license as EvidenceLicense);

      db.prepare(`
        INSERT INTO evidence_sources (
          id, source_name, source_url, license, commercial_reuse_allowed,
          automated_retrieval_allowed, parent_can_access_free, retrieval_method,
          last_rights_check, review_status
        ) VALUES (?, ?, ?, ?, ?, 1, 1, ?, datetime('now'), ?)
      `).run(
        sourceId,
        sourceName,
        sourceUrl,
        license,
        isAllowed ? 1 : 0,
        retrievalMethod || "manually_uploaded",
        isAllowed ? "approved" : "pending"
      );

      return NextResponse.json({ success: true, sourceId });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Admin operation failed" },
      { status: 500 }
    );
  }
}
