/**
 * Entitlement Management
 *
 * Server-side entitlement verification.
 * Content remains server-side until entitlement is confirmed.
 *
 * Per spec sections 6, 14.
 */
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../db/schema";

export interface Entitlement {
  id: string;
  sessionId: string;
  generationId: string | null;
  providerTransactionId: string;
  productType: "weekly" | "monthly" | "yearly";
  paymentStatus: "pending" | "paid" | "refunded" | "failed";
  purchaseTimestamp: string;
}

/**
 * Create a new entitlement record.
 * This is called AFTER payment provider confirms payment (webhook),
 * never based on front-end state.
 */
export function createEntitlement(params: {
  sessionId: string;
  generationId?: string;
  providerTransactionId: string;
  productType: "weekly" | "monthly" | "yearly";
  paymentStatus: "pending" | "paid";
}): Entitlement {
  const db = getDb();
  const id = uuidv4();

  db.prepare(
    `INSERT INTO purchase_entitlements
     (id, session_id, generation_id, provider_transaction_id, product_type, payment_status)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    params.sessionId,
    params.generationId ?? null,
    params.providerTransactionId,
    params.productType,
    params.paymentStatus
  );

  return {
    id,
    sessionId: params.sessionId,
    generationId: params.generationId ?? null,
    providerTransactionId: params.providerTransactionId,
    productType: params.productType,
    paymentStatus: params.paymentStatus,
    purchaseTimestamp: new Date().toISOString(),
  };
}

/**
 * Verify that a session has an active paid entitlement for a generation.
 * This MUST be called server-side before releasing any protected content.
 */
export function verifyEntitlement(
  sessionId: string,
  generationId: string
): Entitlement | null {
  const db = getDb();

  const row = db
    .prepare(
      `SELECT * FROM purchase_entitlements
       WHERE session_id = ?
       AND generation_id = ?
       AND payment_status = 'paid'
       ORDER BY purchase_timestamp DESC
       LIMIT 1`
    )
    .get(sessionId, generationId) as Record<string, unknown> | undefined;

  if (!row) return null;

  return {
    id: String(row.id),
    sessionId: String(row.session_id || row.sessionId),
    generationId: (row.generation_id || row.generationId || null) as string | null,
    providerTransactionId: String(row.provider_transaction_id || row.providerTransactionId),
    productType: (row.product_type || row.productType) as "weekly" | "monthly" | "yearly",
    paymentStatus: (row.payment_status || row.paymentStatus) as "pending" | "paid" | "refunded" | "failed",
    purchaseTimestamp: String(row.purchase_timestamp || row.purchaseTimestamp),
  };
}

/**
 * Update entitlement payment status.
 * Called when Stripe webhook confirms or updates payment.
 */
export function updateEntitlementStatus(
  providerTransactionId: string,
  paymentStatus: "paid" | "refunded" | "failed",
  generationId?: string
): void {
  const db = getDb();
  db.prepare(
    `UPDATE purchase_entitlements
     SET payment_status = ?, generation_id = COALESCE(?, generation_id), updated_at = datetime('now')
     WHERE provider_transaction_id = ?`
  ).run(paymentStatus, generationId ?? null, providerTransactionId);
}

/**
 * Get all entitlements for a session (for dashboard display).
 */
export function getSessionEntitlements(sessionId: string): Entitlement[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM purchase_entitlements
       WHERE session_id = ?
       AND payment_status = 'paid'
       ORDER BY purchase_timestamp DESC`
    )
    .all(sessionId) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    id: String(row.id),
    sessionId: String(row.session_id || row.sessionId),
    generationId: (row.generation_id || row.generationId || null) as string | null,
    providerTransactionId: String(row.provider_transaction_id || row.providerTransactionId),
    productType: (row.product_type || row.productType) as "weekly" | "monthly" | "yearly",
    paymentStatus: (row.payment_status || row.paymentStatus) as "pending" | "paid" | "refunded" | "failed",
    purchaseTimestamp: String(row.purchase_timestamp || row.purchaseTimestamp),
  }));
}

/**
 * Check if session has ANY paid entitlement for a product type.
 */
export function hasEntitlementForProduct(
  sessionId: string,
  productType: "weekly" | "monthly" | "yearly"
): boolean {
  const db = getDb();
  const result = db
    .prepare(
      `SELECT 1 FROM purchase_entitlements
       WHERE session_id = ? AND product_type = ? AND payment_status = 'paid'
       LIMIT 1`
    )
    .get(sessionId, productType);
  return result !== undefined;
}

/**
 * Get the full planner data, but ONLY if entitlement is confirmed.
 * Protected content is never released without this check.
 */
export function getProtectedPlannerData(
  sessionId: string,
  generationId: string
): unknown | null {
  const db = getDb();

  // First verify entitlement
  const entitlement = verifyEntitlement(sessionId, generationId);
  if (!entitlement) return null;

  // Then retrieve the protected data
  const generation = db
    .prepare(
      `SELECT full_data FROM planner_generations
       WHERE id = ? AND session_id = ?`
    )
    .get(generationId, sessionId) as { full_data: string } | undefined;

  if (!generation?.full_data) return null;

  return JSON.parse(generation.full_data);
}
