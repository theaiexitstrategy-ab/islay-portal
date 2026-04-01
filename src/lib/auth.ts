import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Creates a Supabase client that reads/writes the auth session
 * from Next.js request cookies (server-side only).
 */
export async function getSupabaseServer() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("sb-access-token")?.value;
  const refreshToken = cookieStore.get("sb-refresh-token")?.value;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  if (accessToken && refreshToken) {
    await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  }

  return supabase;
}

/**
 * Persists the Supabase session tokens as httpOnly cookies.
 */
export async function setSessionCookies(
  accessToken: string,
  refreshToken: string,
) {
  const cookieStore = await cookies();
  const opts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  };
  cookieStore.set("sb-access-token", accessToken, opts);
  cookieStore.set("sb-refresh-token", refreshToken, opts);
}

/**
 * Clears all session cookies.
 */
export async function clearSessionCookies() {
  const cookieStore = await cookies();
  cookieStore.delete("sb-access-token");
  cookieStore.delete("sb-refresh-token");
}
