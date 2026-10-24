import { NextRequest, NextResponse } from "next/server";
import { adminConfigured, issueAdminToken, passwordMatches, setAdminCookie, validateMutationRequest } from "@/lib/auth/admin";

export async function POST(request: NextRequest) {
  const invalid = validateMutationRequest(request);
  if (invalid) return invalid;
  if (!adminConfigured()) return NextResponse.json({ error: "Admin access is not configured" }, { status: 503 });
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !("password" in body) || typeof body.password !== "string") {
    return NextResponse.json({ error: "Invalid login request" }, { status: 400 });
  }
  if (!passwordMatches(body.password)) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  return setAdminCookie(NextResponse.json({ success: true }), await issueAdminToken());
}
