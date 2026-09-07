/**
 * Evidence License Utilities
 *
 * Implements the commercial-use license allowlist per spec section 2B.
 * This is implemented as code, NOT relying on LLM judgment.
 */

export type EvidenceLicense =
  | "PUBLIC_DOMAIN"
  | "CC0"
  | "CC_BY"
  | "CC_BY_SA"
  | "CC_BY_ND"
  | "CC_BY_NC"
  | "CC_BY_NC_SA"
  | "CC_BY_NC_ND"
  | "CUSTOM"
  | "UNKNOWN";

/**
 * Returns true if this license permits automatic ingestion for commercial use.
 * Strict allowlist: only PUBLIC_DOMAIN, CC0, CC_BY.
 */
export function canAutoIngestForCommercialUse(license: EvidenceLicense): boolean {
  return (["PUBLIC_DOMAIN", "CC0", "CC_BY"] as EvidenceLicense[]).includes(license);
}

/**
 * Returns true if this license requires explicit manual administrator review
 * before ingestion (may impose additional obligations).
 */
export function requiresManualReview(license: EvidenceLicense): boolean {
  return (["CC_BY_SA", "CC_BY_ND", "CUSTOM"] as EvidenceLicense[]).includes(license);
}

/**
 * Returns true if this license is definitively NOT allowed for commercial use.
 * NC (non-commercial) variants are always blocked.
 */
export function isBlockedForCommercialUse(license: EvidenceLicense): boolean {
  return (
    ["CC_BY_NC", "CC_BY_NC_SA", "CC_BY_NC_ND", "UNKNOWN"] as EvidenceLicense[]
  ).includes(license);
}

/**
 * Human-readable license display name.
 */
export function getLicenseDisplayName(license: EvidenceLicense): string {
  const names: Record<EvidenceLicense, string> = {
    PUBLIC_DOMAIN: "Public Domain",
    CC0: "CC0 (No Rights Reserved)",
    CC_BY: "CC BY (Attribution)",
    CC_BY_SA: "CC BY-SA (Attribution-ShareAlike)",
    CC_BY_ND: "CC BY-ND (Attribution-NoDerivatives)",
    CC_BY_NC: "CC BY-NC (Attribution-NonCommercial)",
    CC_BY_NC_SA: "CC BY-NC-SA (Attribution-NonCommercial-ShareAlike)",
    CC_BY_NC_ND: "CC BY-NC-ND (Attribution-NonCommercial-NoDerivatives)",
    CUSTOM: "Custom License",
    UNKNOWN: "Unknown License",
  };
  return names[license];
}

/**
 * Ingestion decision for a given source.
 */
export type IngestionDecision =
  | { allowed: true; requiresReview: false }
  | { allowed: false; requiresReview: true; reason: string }
  | { allowed: false; requiresReview: false; reason: string };

export function getIngestionDecision(license: EvidenceLicense): IngestionDecision {
  if (canAutoIngestForCommercialUse(license)) {
    return { allowed: true, requiresReview: false };
  }
  if (requiresManualReview(license)) {
    return {
      allowed: false,
      requiresReview: true,
      reason: `License "${getLicenseDisplayName(license)}" requires explicit administrator review before ingestion due to potential additional obligations.`,
    };
  }
  return {
    allowed: false,
    requiresReview: false,
    reason: `License "${getLicenseDisplayName(license)}" does not permit commercial use ingestion.`,
  };
}

/**
 * Source access record interface — every evidence source must have this.
 * Per spec section 2D.
 */
export interface EvidenceSourceRights {
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  termsUrl?: string;
  license: EvidenceLicense;
  commercialReuseAllowed: boolean;
  automatedRetrievalAllowed: boolean;
  parentCanAccessFree: boolean;
  retrievalMethod:
    | "official_api"
    | "official_bulk_dataset"
    | "official_feed"
    | "manually_uploaded"
    | "other";
  apiEndpoint?: string;
  attributionRequired: boolean;
  attributionText?: string;
  lastRightsCheck: string; // ISO date string
  rightsCheckNotes?: string;
}

/**
 * Gate check: can this source enter the production vector database?
 * All five conditions must be true per spec section 2D.
 */
export function canEnterProductionIndex(rights: EvidenceSourceRights): boolean {
  return (
    rights.automatedRetrievalAllowed &&
    rights.commercialReuseAllowed &&
    rights.parentCanAccessFree &&
    canAutoIngestForCommercialUse(rights.license)
  );
}
