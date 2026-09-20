import crypto from "crypto";

function getSecret(): string {
  return process.env.SESSION_SECRET || "dev-secret-do-not-use-in-production-please-set-env";
}

/**
 * Signs a generationId with HMAC-SHA256.
 * Provides a stateless authorization proof that the caller initiated this generation,
 * serving as a reliable fallback when HTTP-only cookies are blocked or isolated.
 */
export function signGenerationToken(generationId: string): string {
  const secret = getSecret();
  return crypto.createHmac("sha256", secret).update(generationId).digest("hex");
}

/**
 * Verifies that the provided token matches the HMAC signature of the generationId.
 */
export function verifyGenerationToken(generationId: string, token: string): boolean {
  if (!generationId || !token) return false;
  try {
    const expected = signGenerationToken(generationId);
    const expectedBuf = Buffer.from(expected, "hex");
    const tokenBuf = Buffer.from(token, "hex");
    if (expectedBuf.length !== tokenBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, tokenBuf);
  } catch {
    return false;
  }
}
