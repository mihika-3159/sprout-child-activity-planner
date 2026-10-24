import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db/schema";
import { ensureEvidenceSeeded } from "@/lib/evidence/seed";
import { defaultEmbeddingProvider } from "@/lib/embeddings/local";
import { canAutoIngestForCommercialUse, type EvidenceLicense } from "@/lib/evidence/license";
import { v4 as uuidv4 } from "uuid";

const ALLOWED_LICENSES: EvidenceLicense[] = [
  "PUBLIC_DOMAIN", "CC0", "CC_BY", "CC_BY_SA", "CC_BY_ND",
  "CC_BY_NC", "CC_BY_NC_SA", "CC_BY_NC_ND", "CUSTOM", "UNKNOWN",
];
const ALLOWED_RETRIEVAL_METHODS = [
  "official_api", "official_bulk_dataset", "official_feed", "manually_uploaded", "other",
];

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest) {
  // Defense in depth: do not rely exclusively on the Next.js proxy.
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    await ensureEvidenceSeeded();
    const db = getDb();
    const sources = db.prepare("SELECT * FROM evidence_sources ORDER BY created_at DESC").all();
    const chunks = db.prepare(`
      SELECT c.*, s.source_name
      FROM evidence_chunks c
      JOIN evidence_sources s ON c.source_id = s.id
      ORDER BY c.created_at DESC
    `).all().map((chunk) => ({
      ...chunk,
      // The JSON storage adapter returns camelCase while the admin UI expects snake_case.
      id: chunk.id ?? chunk.chunkId,
      source_title: chunk.source_title ?? chunk.sourceTitle,
      chunk_text: chunk.chunk_text ?? chunk.chunkText,
      developmental_domains: chunk.developmental_domains ?? JSON.stringify(chunk.developmentalDomains ?? []),
      evidence_strength: chunk.evidence_strength ?? chunk.evidenceStrength,
      approval_status: chunk.approval_status ?? chunk.approvalStatus,
      age_range_min: chunk.age_range_min ?? chunk.ageMin,
      age_range_max: chunk.age_range_max ?? chunk.ageMax,
    }));
    return NextResponse.json({ sources, chunks }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[Admin evidence GET failed]", error);
    return NextResponse.json({ error: "Unable to load evidence" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request, true);
  if (denied) return denied;

  try {
    const raw: unknown = await request.json().catch(() => null);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return badRequest("Invalid evidence request");
    }
    const body = raw as Record<string, unknown>;

    if (body.action === "update_status") {
      const { chunkId, status } = body;
      if (typeof chunkId !== "string" || !chunkId || chunkId.length > 200 ||
          (status !== "pending" && status !== "approved" && status !== "rejected")) {
        return badRequest("Invalid evidence status update");
      }
      const db = getDb();
      const chunk = db.prepare("SELECT * FROM evidence_chunks").all()
        .find((item) => item.chunkId === chunkId || item.id === chunkId);
      if (!chunk) return NextResponse.json({ error: "Evidence chunk not found" }, { status: 404 });

      if (status === "approved") {
        const source = db.prepare("SELECT * FROM evidence_sources").all()
          .find((item) => item.id === (chunk.sourceId ?? chunk.source_id));
        if (!source || source.review_status !== "approved" ||
            source.commercial_reuse_allowed !== 1 ||
            source.automated_retrieval_allowed !== 1 ||
            source.parent_can_access_free !== 1 ||
            !canAutoIngestForCommercialUse(source.license as EvidenceLicense)) {
          return NextResponse.json({ error: "Source rights are not verified for approval" }, { status: 409 });
        }
      }

      db.prepare("UPDATE evidence_chunks SET approval_status = ?, reviewed_at = datetime('now') WHERE id = ?")
        .run(status, chunkId);
      return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
    }

    if (body.action === "add_chunk") {
      const { sourceId, chunkText, sourceTitle, organizationAuthors, publicationYear,
        ageRangeMin, ageRangeMax, developmentalDomains, evidenceStrength } = body;
      if (typeof sourceId !== "string" || !sourceId || sourceId.length > 200 ||
          typeof chunkText !== "string" || chunkText.trim().length < 30 || chunkText.length > 12000 ||
          typeof sourceTitle !== "string" || !sourceTitle.trim() || sourceTitle.length > 300 ||
          (organizationAuthors !== undefined && (typeof organizationAuthors !== "string" || organizationAuthors.length > 300)) ||
          (publicationYear !== undefined && (typeof publicationYear !== "number" || !Number.isInteger(publicationYear) || publicationYear < 1900 || publicationYear > 2100)) ||
          (ageRangeMin !== undefined && (typeof ageRangeMin !== "number" || !Number.isInteger(ageRangeMin) || ageRangeMin < 0 || ageRangeMin > 18)) ||
          (ageRangeMax !== undefined && (typeof ageRangeMax !== "number" || !Number.isInteger(ageRangeMax) || ageRangeMax < 0 || ageRangeMax > 18)) ||
          (typeof ageRangeMin === "number" && typeof ageRangeMax === "number" && ageRangeMin > ageRangeMax) ||
          (developmentalDomains !== undefined && (!Array.isArray(developmentalDomains) || developmentalDomains.length < 1 ||
            developmentalDomains.length > 20 || !developmentalDomains.every((d) => typeof d === "string" && d.length > 0 && d.length <= 60))) ||
          (evidenceStrength !== undefined && evidenceStrength !== "strong" && evidenceStrength !== "moderate" && evidenceStrength !== "limited")) {
        return badRequest("Invalid evidence chunk");
      }
      const db = getDb();
      const source = db.prepare("SELECT * FROM evidence_sources").all().find((item) => item.id === sourceId);
      if (!source) return NextResponse.json({ error: "Evidence source not found" }, { status: 404 });

      const ageMin = typeof ageRangeMin === "number" ? ageRangeMin : 3;
      const ageMax = typeof ageRangeMax === "number" ? ageRangeMax : 10;
      if (ageMin > ageMax) return badRequest("Invalid evidence age range");
      const chunkId = uuidv4();
      const embedding = await defaultEmbeddingProvider.createEmbedding(chunkText);
      const buffer = Buffer.from(new Float32Array(embedding).buffer);
      const sourceUrl = typeof source.source_url === "string" ? source.source_url : "";

      // Match the 20 positional fields expected by the JSON database adapter.
      // Never auto-approve new, unreviewed evidence.
      db.prepare(`
        INSERT INTO evidence_chunks (
          id, source_id, chunk_text, chunk_index, source_title, organization_authors,
          publication_year, source_type, url_doi, free_access_url,
          age_range_min, age_range_max, developmental_domains, activity_categories,
          supervision_considerations, safety_considerations, evidence_strength,
          approval_status, embedding, embedding_dimensions
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        chunkId, sourceId, chunkText, 0, sourceTitle,
        typeof organizationAuthors === "string" ? organizationAuthors : "",
        typeof publicationYear === "number" ? publicationYear : new Date().getFullYear(),
        "Admin submission", sourceUrl, sourceUrl, ageMin, ageMax,
        JSON.stringify(Array.isArray(developmentalDomains) ? developmentalDomains : ["cognitive"]),
        "[]", "", "", typeof evidenceStrength === "string" ? evidenceStrength : "limited",
        "pending", buffer, defaultEmbeddingProvider.dimensions,
      );
      return NextResponse.json({ success: true, chunkId, approvalStatus: "pending" }, { headers: { "Cache-Control": "no-store" } });
    }

    if (body.action === "add_source") {
      const { sourceName, sourceUrl, license, retrievalMethod } = body;
      let validUrl = false;
      if (typeof sourceUrl === "string" && sourceUrl.length <= 2048) {
        try {
          validUrl = ["https:", "http:"].includes(new URL(sourceUrl).protocol);
        } catch { /* malformed URL */ }
      }
      if (typeof sourceName !== "string" || sourceName.trim().length < 2 || sourceName.length > 200 ||
          !validUrl || typeof license !== "string" || !ALLOWED_LICENSES.includes(license as EvidenceLicense) ||
          (retrievalMethod !== undefined && (typeof retrievalMethod !== "string" || !ALLOWED_RETRIEVAL_METHODS.includes(retrievalMethod)))) {
        return badRequest("Invalid evidence source");
      }
      const sourceId = `src-${uuidv4().slice(0, 8)}`;
      const allowedLicense = canAutoIngestForCommercialUse(license as EvidenceLicense);
      const db = getDb();

      // A claimed license is not a verified rights check. Keep new sources pending.
      // Match all 16 positional fields expected by the JSON database adapter.
      db.prepare(`
        INSERT INTO evidence_sources (
          id, source_name, source_url, terms_url, license, commercial_reuse_allowed,
          automated_retrieval_allowed, parent_can_access_free, retrieval_method,
          api_endpoint, attribution_required, attribution_text, last_rights_check,
          rights_check_notes, review_status, reviewer_notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        sourceId, sourceName.trim(), sourceUrl, null, license, allowedLicense ? 1 : 0,
        0, 0, typeof retrievalMethod === "string" ? retrievalMethod : "manually_uploaded",
        null, license === "CC_BY" ? 1 : 0, null, null,
        "Rights verification pending", "pending", "Submitted through admin console",
      );
      return NextResponse.json({ success: true, sourceId, reviewStatus: "pending" }, { headers: { "Cache-Control": "no-store" } });
    }

    return badRequest("Unknown action");
  } catch (error) {
    console.error("[Admin evidence POST failed]", error);
    return NextResponse.json({ error: "Admin evidence operation failed" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
