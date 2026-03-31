import { NextResponse } from "next/server";
import { listRecords } from "@/lib/airtable";

const TABLE_ID = process.env.AIRTABLE_ARTISTS_TABLE_ID!;

export async function GET() {
  try {
    const records = await listRecords(TABLE_ID);
    return NextResponse.json(records);
  } catch (error) {
    console.error("Failed to fetch artists:", error);
    return NextResponse.json(
      { error: "Failed to fetch artists" },
      { status: 500 },
    );
  }
}
