import { NextResponse } from "next/server";

import { REVALIDATE_STATIC_DAY } from "@/lib/data/cache-policy";
import { resolve13fIssuerTickerCached } from "@/lib/superinvestors/resolve-13f-issuer-ticker";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const issuer = new URL(request.url).searchParams.get("issuer")?.trim() ?? "";
  if (issuer.length < 2) {
    return NextResponse.json({ ticker: null });
  }

  const ticker = await resolve13fIssuerTickerCached(issuer);

  return NextResponse.json(
    { ticker },
    {
      headers: {
        "Cache-Control": `public, s-maxage=${REVALIDATE_STATIC_DAY}, stale-while-revalidate=${REVALIDATE_STATIC_DAY}`,
      },
    },
  );
}
