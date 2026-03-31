const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;

const BASE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`;

const headers = {
  Authorization: `Bearer ${AIRTABLE_TOKEN}`,
  "Content-Type": "application/json",
};

export interface AirtableRecord<T = Record<string, unknown>> {
  id: string;
  fields: T;
  createdTime: string;
}

interface AirtableListResponse<T> {
  records: AirtableRecord<T>[];
  offset?: string;
}

export async function listRecords<T = Record<string, unknown>>(
  tableId: string,
  options?: { filterByFormula?: string; sort?: { field: string; direction: "asc" | "desc" }[]; maxRecords?: number }
): Promise<AirtableRecord<T>[]> {
  const params = new URLSearchParams();
  if (options?.filterByFormula) params.set("filterByFormula", options.filterByFormula);
  if (options?.maxRecords) params.set("maxRecords", String(options.maxRecords));
  if (options?.sort) {
    options.sort.forEach((s, i) => {
      params.set(`sort[${i}][field]`, s.field);
      params.set(`sort[${i}][direction]`, s.direction);
    });
  }

  let allRecords: AirtableRecord<T>[] = [];
  let offset: string | undefined;

  do {
    if (offset) params.set("offset", offset);
    const res = await fetch(`${BASE_URL}/${tableId}?${params.toString()}`, { headers, cache: "no-store" });
    if (!res.ok) throw new Error(`Airtable error: ${res.status} ${await res.text()}`);
    const data: AirtableListResponse<T> = await res.json();
    allRecords = allRecords.concat(data.records);
    offset = data.offset;
  } while (offset && !options?.maxRecords);

  return allRecords;
}

export async function updateRecord<T = Record<string, unknown>>(
  tableId: string,
  recordId: string,
  fields: Partial<T>
): Promise<AirtableRecord<T>> {
  const res = await fetch(`${BASE_URL}/${tableId}/${recordId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`Airtable error: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function createRecord<T = Record<string, unknown>>(
  tableId: string,
  fields: Partial<T>
): Promise<AirtableRecord<T>> {
  const res = await fetch(`${BASE_URL}/${tableId}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`Airtable error: ${res.status} ${await res.text()}`);
  return res.json();
}
