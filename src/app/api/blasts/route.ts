import { NextResponse } from "next/server";
import { listRecords } from "@/lib/airtable";

const TABLE_ID = process.env.AIRTABLE_BLASTS_TABLE_ID!;

export async function GET() {
  try {
    const records = await listRecords(TABLE_ID, {
      sort: [{ field: "Date Sent", direction: "desc" }],
    });
    return NextResponse.json(records);
  } catch (error) {
    console.error("Failed to fetch blasts:", error);
    return NextResponse.json(
      { error: "Failed to fetch blasts" },
      { status: 500 },
    );
  }
}
