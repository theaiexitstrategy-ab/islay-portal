import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

// NOTE: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be registered in Google Cloud Console
// Redirect URI: https://portal.islaystudiosllc.com/auth/callback/google
const CLIENT_ID_DB = "islay_studios";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(
      new URL("/settings?oauth_error=google", request.url),
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL || "https://portal.islaystudiosllc.com"}/auth/callback/google`;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL("/settings?oauth_error=not_configured", request.url),
    );
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }).toString(),
    });
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      return NextResponse.redirect(
        new URL("/settings?oauth_error=token_failed", request.url),
      );
    }

    const supabase = getSupabaseAdmin();
    await supabase.from("social_accounts").upsert(
      {
        client_id: CLIENT_ID_DB,
        platform: "google",
        handle: "Google Analytics",
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        token_expires_at: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
          : null,
        last_synced: new Date().toISOString(),
      },
      { onConflict: "client_id,platform" },
    );

    // Redirect to settings with a prompt to enter GA4 Property ID
    return NextResponse.redirect(
      new URL("/settings?oauth_success=google&prompt_ga_property=true", request.url),
    );
  } catch (err) {
    console.error("Google OAuth error:", err);
    return NextResponse.redirect(
      new URL("/settings?oauth_error=google", request.url),
    );
  }
}
