import { cookies } from "next/headers";
import { createHash } from "crypto";

const COOKIE_NAME = "auth_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET environment variable is not set");
  }
  return secret;
}

function generateToken(): string {
  const secret = getAuthSecret();
  const timestamp = Date.now().toString();
  const hash = createHash("sha256")
    .update(secret + timestamp)
    .digest("hex");
  return `${timestamp}.${hash}`;
}

function validateToken(token: string): boolean {
  const secret = getAuthSecret();
  const [timestamp, hash] = token.split(".");
  if (!timestamp || !hash) return false;

  const expectedHash = createHash("sha256")
    .update(secret + timestamp)
    .digest("hex");

  return hash === expectedHash;
}

export async function setAuthCookie(): Promise<void> {
  const token = generateToken();
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;
  return validateToken(token);
}

export function validateCode(code: string): boolean {
  const secret = getAuthSecret();
  return code === secret;
}
