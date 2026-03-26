import { NextResponse } from "next/server";

import { loadIndicesCardsUncached } from "@/lib/screener/indices-today";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const cards = await loadIndicesCardsUncached();
  // Temporary debug log: verify exact payload served to UI.
  console.log("[indices-route] payload", JSON.stringify(cards, null, 2));
  return NextResponse.json(
    { cards, fetchedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
  );
}

