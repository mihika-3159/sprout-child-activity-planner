/**
 * Anonymous Session Management
 *
 * Generates and validates HTTP-only cookie sessions.
 * No email, password, or account required.
 * Uses jose for JWT signing.
 */
import { SignJWT, jwtVerify } from "jose";
import { v4 as uuidv4 } from "uuid";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "anon_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 90; // 90 days

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET must be set in production (min 32 chars)");
    }
    // Development fallback — NEVER use in production
    console.warn("[Session] Using insecure development SESSION_SECRET. Set SESSION_SECRET in .env.local");
    return new TextEncoder().encode("dev-secret-do-not-use-in-production-please-set-env");
  }
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  sessionId: string;
  createdAt: number;
}

export async function createSession(): Promise<string> {
  const sessionId = uuidv4();
  const secret = getSecret();

  const token = await new SignJWT({ sessionId, createdAt: Date.now() })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("90d")
    .sign(secret);

  return token;
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const secret = getSecret();
    const { payload } = await jwtVerify(token, secret);
    if (typeof payload.sessionId !== "string") return null;
    return {
      sessionId: payload.sessionId as string,
      createdAt: payload.createdAt as number,
    };
  } catch {
    return null;
  }
}

export async function getSessionFromRequest(
  request: NextRequest
): Promise<SessionPayload | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function getOrCreateSession(): Promise<{
  sessionId: string;
  isNew: boolean;
  token: string;
}> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (existing) {
    const session = await verifySession(existing);
    if (session) {
      return { sessionId: session.sessionId, isNew: false, token: existing };
    }
  }

  // Create new session
  const token = await createSession();
  const session = await verifySession(token);
  return {
    sessionId: session!.sessionId,
    isNew: true,
    token,
  };
}

export function setSessionCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  return response;
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}

export { SESSION_COOKIE_NAME };
