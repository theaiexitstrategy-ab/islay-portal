import { NextResponse } from "next/server";
import { listRecords } from "@/lib/airtable";

const TABLE_ID = process.env.AIRTABLE_LEADS_TABLE_ID!;

export async function GET() {
  try {
    console.log("[leads/GET] Fetching from table:", TABLE_ID);
    console.log("[leads/GET] AIRTABLE_BASE_ID set:", !!process.env.AIRTABLE_BASE_ID);
    console.log("[leads/GET] AIRTABLE_TOKEN set:", !!process.env.AIRTABLE_TOKEN);

    const records = await listRecords(TABLE_ID, {
      sort: [{ field: "Date Entered Funnel", direction: "desc" }],
    });

    console.log("[leads/GET] Records returned:", records.length);
    if (records.length > 0) {
      console.log("[leads/GET] First record fields:", Object.keys(records[0].fields));
    }

    return NextResponse.json(records);
  } catch (error) {
    console.error("Failed to fetch leads:", error);
    return NextResponse.json(
      { error: "Failed to fetch leads" },
      { status: 500 },
    );
  }
}
