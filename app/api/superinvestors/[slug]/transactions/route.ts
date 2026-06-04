import { NextResponse } from "next/server";

import { SUPERINVESTOR_REGISTRY } from "@/lib/superinvestors/superinvestor-registry";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ slug: string }> };

/** Full 13F transaction history (~2007–present). Berkshire: persisted, scoped to current holdings. */
export async function GET(_request: Request, { params }: Ctx) {
  const { slug } = await params;
  const item = SUPERINVESTOR_REGISTRY.find((entry) => entry.slug === slug);
  if (!item) {
    return NextResponse.json({ error: "Unknown superinvestor" }, { status: 404 });
  }

  try {
    const data = await item.loadTransactions();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, s-maxage=21600, stale-while-revalidate=86400" },
    });
  } catch {
    return NextResponse.json({ error: "Could not load transactions" }, { status: 502 });
  }
}
