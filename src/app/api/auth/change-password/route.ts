import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { oldPassword, newPassword } = await req.json();

    if (!oldPassword || !newPassword) {
      return NextResponse.json(
        { error: "Old password and new password are required." },
        { status: 400 },
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters." },
        { status: 400 },
      );
    }

    const stored = process.env.PORTAL_PASSWORD;
    if (!stored) {
      return NextResponse.json(
        { error: "Server configuration error." },
        { status: 500 },
      );
    }

    // Timing-safe comparison for the old password
    const oldMatch = crypto.timingSafeEqual(
      Buffer.from(oldPassword.padEnd(64, "\0")),
      Buffer.from(stored.padEnd(64, "\0")),
    );

    if (!oldMatch) {
      return NextResponse.json(
        { error: "Current password is incorrect." },
        { status: 401 },
      );
    }

    // We cannot change env vars at runtime, so instruct the user
    return NextResponse.json({
      message:
        "Password change requested. Please update PORTAL_PASSWORD in your Vercel environment variables.",
    });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
