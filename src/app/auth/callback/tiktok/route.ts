import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

// NOTE: TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET must be registered in TikTok Developer Console
// Redirect URI: https://portal.islaystudiosllc.com/auth/callback/tiktok
const CLIENT_ID_DB = "islay_studios";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(
      new URL("/settings?oauth_error=tiktok", request.url),
    );
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL || "https://portal.islaystudiosllc.com"}/auth/callback/tiktok`;

  if (!clientKey || !clientSecret) {
    return NextResponse.redirect(
      new URL("/settings?oauth_error=not_configured", request.url),
    );
  }

  try {
    // Exchange code for access token
    const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: clientKey,
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

    // Get user info
    const userRes = await fetch(
      "https://open.tiktokapis.com/v2/user/info/?fields=display_name,follower_count",
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      },
    );
    const userData = await userRes.json();
    const user = userData.data?.user || {};

    const supabase = getSupabaseAdmin();
    await supabase.from("social_accounts").upsert(
      {
        client_id: CLIENT_ID_DB,
        platform: "tiktok",
        handle: user.display_name || "",
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        token_expires_at: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
          : null,
        follower_count: user.follower_count || 0,
        last_synced: new Date().toISOString(),
      },
      { onConflict: "client_id,platform" },
    );

    return NextResponse.redirect(
      new URL("/settings?oauth_success=tiktok", request.url),
    );
  } catch (err) {
    console.error("TikTok OAuth error:", err);
    return NextResponse.redirect(
      new URL("/settings?oauth_error=tiktok", request.url),
    );
  }
}
