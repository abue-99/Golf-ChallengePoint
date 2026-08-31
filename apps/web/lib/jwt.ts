import jwt from "jsonwebtoken";

const SECRET = process.env.ACCESS_SECRET || "dev-secret-change-me";

export function signJwt(payload: Record<string, unknown>) {
  return jwt.sign(payload, SECRET, {
    expiresIn: "7d",
  });
}

export function verifyJwt<T = Record<string, unknown>>(token: string): T | null {
  try {
    return jwt.verify(token, SECRET) as T;
  } catch {
    return null;
  }
}