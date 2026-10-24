/**
 * Admin authentication is independent of anonymous family sessions.
 * Never grant admin access from an email, client header, or anonymous JWT.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

const ISSUER = "sprout";
const AUDIENCE = "sprout-admin";
const MAX_AGE = 8 * 60 * 60;
const encoder = new TextEncoder();

export function adminCookieName(): string {
  return process.env.NODE_ENV === "production" ? "__Host-sprout-admin" : "sprout-admin";
}

function credentials(): { password: string; secret: Uint8Array } | null {
  const password = process.env.ADMIN_PASSWORD;
  const signingSecret = process.env.ADMIN_SESSION_SECRET;
  if (!password || !signingSecret || password.length < 32 || signingSecret.length < 32) return null;
  if (password === signingSecret) return null;
  return { password, secret: encoder.encode(signingSecret) };
}

function deny(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export function adminConfigured(): boolean {
  return credentials() !== null;
}

export function passwordMatches(candidate: string): boolean {
  const config = credentials();
  if (!config || candidate.length > 4096) return false;
  const supplied = createHash("sha256").update(candidate, "utf8").digest();
  const expected = createHash("sha256").update(config.password, "utf8").digest();
  return timingSafeEqual(supplied, expected);
}

export function validateMutationRequest(request: NextRequest): NextResponse | null {
  const origin = request.headers.get("origin");
  if (!origin || origin === "null") return deny("Forbidden", 403);
  try {
    if (new URL(origin).origin !== request.nextUrl.origin) return deny("Forbidden", 403);
  } catch {
    return deny("Forbidden", 403);
  }
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return deny("Forbidden", 403);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return deny("Expected JSON", 415);
  }
  return null;
}

export async function issueAdminToken(): Promise<string> {
  const config = credentials();
  if (!config) throw new Error("Admin access is not configured");
  return new SignJWT({ role: "admin", purpose: "sprout-admin-console" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(config.secret);
}

export async function requireAdmin(request: NextRequest, mutation = false): Promise<NextResponse | null> {
  if (mutation) {
    const invalid = validateMutationRequest(request);
    if (invalid) return invalid;
  }
  const config = credentials();
  if (!config) return deny("Admin access is not configured", 503);
  const token = request.cookies.get(adminCookieName())?.value;
  if (!token) return deny("Authentication required", 401);
  try {
    const { payload } = await jwtVerify(token, config.secret, {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (payload.role !== "admin" || payload.purpose !== "sprout-admin-console") return deny("Forbidden", 403);
    return null;
  } catch {
    return deny("Authentication required", 401);
  }
}

export function setAdminCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set(adminCookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: MAX_AGE,
    path: "/",
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export function clearAdminCookie(response: NextResponse): NextResponse {
  response.cookies.set(adminCookieName(), "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
