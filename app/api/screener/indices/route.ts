import { NextResponse } from "next/server";

import { CACHE_CONTROL_PUBLIC_SEARCH } from "@/lib/data/cache-policy";
import { getSimpleIndexCards } from "@/lib/screener/simple-index-cards";

export async function GET() {
  const cards = await getSimpleIndexCards();

  return NextResponse.json(
    { cards, fetchedAt: new Date().toISOString() },
    {
      headers: {
        "Cache-Control": CACHE_CONTROL_PUBLIC_SEARCH,
      },
    },
  );
}

