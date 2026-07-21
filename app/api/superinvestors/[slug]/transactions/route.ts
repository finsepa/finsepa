import { NextResponse } from "next/server";

import { peekSuperinvestorFullTransactionsLoadMeta } from "@/lib/superinvestors/superinvestor-13f-full-transactions";
import { SUPERINVESTOR_REGISTRY } from "@/lib/superinvestors/superinvestor-registry";
import { SUPERINVESTOR_SLUG_CIK } from "@/lib/superinvestors/superinvestor-slug-cik";
import { cikPad10 } from "@/lib/superinvestors/superinvestor-13f-freshness";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ slug: string }> };

/** Full 13F transaction history (~2007–present). Warm path reads durable market_snapshot. */
export async function GET(_request: Request, { params }: Ctx) {
  const { slug } = await params;
  const item = SUPERINVESTOR_REGISTRY.find((entry) => entry.slug === slug);
  if (!item) {
    return NextResponse.json({ error: "Unknown superinvestor" }, { status: 404 });
  }

  try {
    const started = Date.now();
    const data = await item.loadTransactions();
    const cik = cikPad10(SUPERINVESTOR_SLUG_CIK[slug] ?? data.cik ?? "");
    const meta = cik ? peekSuperinvestorFullTransactionsLoadMeta(cik) : null;
    const payloadBytes = meta?.payloadBytes ?? JSON.stringify(data).length;

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, s-maxage=21600, stale-while-revalidate=86400",
        "X-Superinvestor-Tx-Ms": String(Math.round(meta?.totalMs ?? Date.now() - started)),
        "X-Superinvestor-Tx-Cache": meta?.cache ?? "unknown",
        "X-Superinvestor-Tx-Read-Ms": String(Math.round(meta?.readMs ?? 0)),
        "X-Superinvestor-Tx-Build-Ms": String(Math.round(meta?.buildMs ?? 0)),
        "X-Superinvestor-Tx-Payload-Bytes": String(payloadBytes),
      },
    });
  } catch {
    return NextResponse.json({ error: "Could not load transactions" }, { status: 502 });
  }
}
