import { NextRequest, NextResponse } from "next/server";
import { getOrCreateSession } from "@/lib/session/anonymous";
import { getDb } from "@/lib/db/schema";
import { verifyEntitlement } from "@/lib/entitlement/check";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ generationId: string }> }
) {
  try {
    const { sessionId } = await getOrCreateSession();
    const { generationId } = await params;

    const db = getDb();
    const generation = db
      .prepare(`
        SELECT id, product_type, status, preview_data, full_data, preferences, created_at
        FROM planner_generations
        WHERE id = ? AND session_id = ?
      `)
      .get(generationId, sessionId) as {
        id: string;
        product_type: string;
        status: string;
        preview_data: string | null;
        full_data: string | null;
        preferences: string;
        created_at: string;
      } | undefined;

    if (!generation) {
      return NextResponse.json({ error: "Planner generation not found" }, { status: 404 });
    }

    // Check server-side entitlement (in demo/beta mode without payment keys, plans are freely unlocked)
    const isDemoMode = process.env.DEMO_MODE !== "false" || !process.env.STRIPE_SECRET_KEY;
    const entitlement = verifyEntitlement(sessionId, generationId);
    const isUnlocked = isDemoMode || !!entitlement;

    if (isUnlocked && generation.full_data) {
      // User is entitled — return full planner data
      const fullPlanner = JSON.parse(generation.full_data);
      return NextResponse.json({
        isUnlocked: true,
        generationId,
        productType: generation.product_type,
        planner: fullPlanner,
      });
    }

    // User is NOT entitled — return ONLY preview data (protected days 2-7 remain server side)
    const previewData = generation.preview_data ? JSON.parse(generation.preview_data) : null;
    return NextResponse.json({
      isUnlocked: false,
      generationId,
      productType: generation.product_type,
      preview: previewData,
    });
  } catch (err: unknown) {
    console.error("[Get Planner Error]:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load planner" },
      { status: 500 }
    );
  }
}
