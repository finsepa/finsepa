import { NextResponse } from "next/server";
import { REVALIDATE_HOT_FAST } from "@/lib/data/cache-policy";
import { getSimpleIndexCards } from "@/lib/screener/simple-index-cards";

export async function GET() {
  const cards = await getSimpleIndexCards();

  return NextResponse.json(
    { cards, fetchedAt: new Date().toISOString() },
    {
      headers: {
        "Cache-Control": `public, s-maxage=${REVALIDATE_HOT_FAST}, stale-while-revalidate=${REVALIDATE_HOT_FAST * 2}`,
      },
    },
  );
}

