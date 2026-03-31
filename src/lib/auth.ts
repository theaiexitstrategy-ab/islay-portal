import { cookies } from "next/headers";
import crypto from "crypto";

const SECRET = process.env.NEXTAUTH_SECRET || "fallback-secret";

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token: string): string {
  return crypto.createHmac("sha256", SECRET).update(token).digest("hex");
}

export async function createSession(): Promise<string> {
  const token = generateToken();
  const hashed = hashToken(token);
  const cookieStore = await cookies();
  cookieStore.set("session_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  // Store the hash in a separate cookie for verification
  cookieStore.set("session_hash", hashed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return token;
}

export async function validateSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;
  const storedHash = cookieStore.get("session_hash")?.value;
  if (!token || !storedHash) return false;
  return hashToken(token) === storedHash;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete("session_token");
  cookieStore.delete("session_hash");
}

export function verifyPassword(input: string): boolean {
  const stored = process.env.PORTAL_PASSWORD;
  if (!stored) return false;
  return crypto.timingSafeEqual(
    Buffer.from(input.padEnd(64, "\0")),
    Buffer.from(stored.padEnd(64, "\0"))
  );
}
