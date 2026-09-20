import { NextRequest, NextResponse } from "next/server";
import { getOrCreateSession, setSessionCookie } from "@/lib/session/anonymous";
import { getDb } from "@/lib/db/schema";
import { verifyEntitlement } from "@/lib/entitlement/check";
import { verifyGenerationToken } from "@/lib/session/generationToken";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ generationId: string }> }
) {
  try {
    const { sessionId, token } = await getOrCreateSession();
    const { generationId } = await params;

    // Check token header or query parameter for stateless fallback auth
    const tokenHeader = request.headers.get("x-generation-token");
    const tokenQuery = request.nextUrl.searchParams.get("token");
    const passedToken = tokenHeader || tokenQuery;
    const isTokenValid = Boolean(passedToken && verifyGenerationToken(generationId, passedToken));

    const db = getDb();
    let generation = db
      .prepare(`
        SELECT id, session_id, product_type, status, preview_data, full_data, preferences, created_at
        FROM planner_generations
        WHERE id = ? AND session_id = ?
      `)
      .get(generationId, sessionId) as {
        id: string;
        session_id?: string;
        product_type: string;
        status: string;
        preview_data: string | null;
        full_data: string | null;
        preferences: string;
        created_at: string;
      } | undefined;

    if (!generation && isTokenValid) {
      generation = db
        .prepare(`
          SELECT id, session_id, product_type, status, preview_data, full_data, preferences, created_at
          FROM planner_generations
          WHERE id = ?
        `)
        .get(generationId) as {
          id: string;
          session_id?: string;
          product_type: string;
          status: string;
          preview_data: string | null;
          full_data: string | null;
          preferences: string;
          created_at: string;
        } | undefined;
    }

    if (!generation) {
      const notFoundRes = NextResponse.json({ error: "Planner generation not found" }, { status: 404 });
      setSessionCookie(notFoundRes, token);
      return notFoundRes;
    }

    // Check server-side entitlement (in demo/beta mode without payment keys, plans are freely unlocked)
    const isDemoMode = process.env.DEMO_MODE !== "false" || !process.env.STRIPE_SECRET_KEY;
    const effectiveSessionId = generation.session_id || sessionId;
    const entitlement = verifyEntitlement(effectiveSessionId, generationId);
    const isUnlocked = isDemoMode || !!entitlement;

    let res: NextResponse;
    if (isUnlocked && generation.full_data) {
      // User is entitled — return full planner data
      const fullPlanner = JSON.parse(generation.full_data);
      res = NextResponse.json({
        isUnlocked: true,
        generationId,
        productType: generation.product_type,
        planner: fullPlanner,
      });
    } else {
      // User is NOT entitled — return ONLY preview data (protected days 2-7 remain server side)
      const previewData = generation.preview_data ? JSON.parse(generation.preview_data) : null;
      res = NextResponse.json({
        isUnlocked: false,
        generationId,
        productType: generation.product_type,
        preview: previewData,
      });
    }

    setSessionCookie(res, token);
    return res;
  } catch (err: unknown) {
    console.error("[Get Planner Error]:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load planner" },
      { status: 500 }
    );
  }
}
