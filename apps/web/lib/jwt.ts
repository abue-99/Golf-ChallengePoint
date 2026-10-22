import jwt from "jsonwebtoken";

/**
 * Verifies access tokens issued by the NestJS API.
 *
 * There is intentionally no fallback secret: without ACCESS_SECRET every
 * token is treated as invalid instead of being checked against a guessable
 * default value.
 */
function getSecret(): string | null {
  const secret = process.env.ACCESS_SECRET;
  if (!secret) {
    console.error("[auth] ACCESS_SECRET is not set – rejecting all tokens.");
    return null;
  }
  return secret;
}

export function verifyJwt<T = Record<string, unknown>>(token: string): T | null {
  const secret = getSecret();
  if (!secret) return null;
  try {
    return jwt.verify(token, secret) as T;
  } catch {
    return null;
  }
}
