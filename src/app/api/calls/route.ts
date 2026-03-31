import { NextResponse } from "next/server";
import { listRecords } from "@/lib/airtable";

const TABLE_ID = process.env.AIRTABLE_CALLS_TABLE_ID!;

export async function GET() {
  try {
    const records = await listRecords(TABLE_ID, {
      sort: [{ field: "Date", direction: "desc" }],
    });
    return NextResponse.json(records);
  } catch (error) {
    console.error("Failed to fetch calls:", error);
    return NextResponse.json(
      { error: "Failed to fetch calls" },
      { status: 500 },
    );
  }
}
