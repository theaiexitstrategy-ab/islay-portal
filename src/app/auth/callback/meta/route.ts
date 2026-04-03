import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

// NOTE: META_APP_ID and META_APP_SECRET must be registered in Meta Developer Console
// Redirect URI: https://portal.islaystudiosllc.com/auth/callback/meta
const CLIENT_ID = "islay_studios";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(
      new URL("/settings?oauth_error=meta", request.url),
    );
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL || "https://portal.islaystudiosllc.com"}/auth/callback/meta`;

  if (!appId || !appSecret) {
    return NextResponse.redirect(
      new URL("/settings?oauth_error=not_configured", request.url),
    );
  }

  try {
    // Exchange code for access token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`,
    );
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      return NextResponse.redirect(
        new URL("/settings?oauth_error=token_failed", request.url),
      );
    }

    // Get long-lived token
    const longTokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokenData.access_token}`,
    );
    const longTokenData = await longTokenRes.json();
    const accessToken = longTokenData.access_token || tokenData.access_token;

    // Get Instagram account info
    const meRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?fields=instagram_business_account{username,followers_count}&access_token=${accessToken}`,
    );
    const meData = await meRes.json();

    let handle = "";
    let followerCount = 0;

    const pages = meData.data || [];
    for (const page of pages) {
      const ig = page.instagram_business_account;
      if (ig) {
        handle = ig.username || "";
        followerCount = ig.followers_count || 0;
        break;
      }
    }

    // Store in social_accounts
    const supabase = getSupabaseAdmin();
    await supabase.from("social_accounts").upsert(
      {
        client_id: CLIENT_ID,
        platform: "instagram",
        handle,
        access_token: accessToken,
        refresh_token: longTokenData.access_token !== tokenData.access_token ? longTokenData.access_token : null,
        token_expires_at: longTokenData.expires_in
          ? new Date(Date.now() + longTokenData.expires_in * 1000).toISOString()
          : null,
        follower_count: followerCount,
        last_synced: new Date().toISOString(),
      },
      { onConflict: "client_id,platform" },
    );

    return NextResponse.redirect(
      new URL("/settings?oauth_success=instagram", request.url),
    );
  } catch (err) {
    console.error("Meta OAuth error:", err);
    return NextResponse.redirect(
      new URL("/settings?oauth_error=meta", request.url),
    );
  }
}
