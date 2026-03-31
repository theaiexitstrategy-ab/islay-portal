import { NextRequest, NextResponse } from "next/server";

// Edge-compatible HMAC-SHA256 using Web Crypto API
async function hmacSha256(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (
    pathname === "/login" ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // Check session cookies exist
  const token = req.cookies.get("session_token")?.value;
  const storedHash = req.cookies.get("session_hash")?.value;

  if (!token || !storedHash) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Verify token hash using Edge-compatible Web Crypto
  const secret = process.env.NEXTAUTH_SECRET || "fallback-secret";
  const expectedHash = await hmacSha256(secret, token);

  if (expectedHash !== storedHash) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
