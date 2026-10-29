import { NextResponse } from "next/server";

import { getSearchDirectory } from "@/lib/search/search-directory";

/** Snapshot-only browse data for global search (no EODHD). */
export async function GET() {
  try {
    const payload = await getSearchDirectory();
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch {
    return NextResponse.json({ builtAt: new Date().toISOString(), rows: [], superinvestors: [] });
  }
}
