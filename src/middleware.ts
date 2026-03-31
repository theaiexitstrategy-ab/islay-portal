import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export function middleware(req: NextRequest) {
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

  // Check session
  const token = req.cookies.get("session_token")?.value;
  const storedHash = req.cookies.get("session_hash")?.value;

  if (!token || !storedHash) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const SECRET = process.env.NEXTAUTH_SECRET || "fallback-secret";
  const expectedHash = crypto.createHmac("sha256", SECRET).update(token).digest("hex");

  if (expectedHash !== storedHash) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
