import { NextResponse } from "next/server";

import { CACHE_CONTROL_PRIVATE_WARM } from "@/lib/data/cache-policy";
import { loadSuperinvestorPerformanceSeries } from "@/lib/superinvestors/superinvestor-performance-series";
import { isSuperinvestorPerformanceEnabled } from "@/lib/superinvestors/superinvestor-performance-types";
import { SUPERINVESTOR_REGISTRY } from "@/lib/superinvestors/superinvestor-registry";

export const runtime = "nodejs";
/** Cold rebuild walks ~20 SEC filings + EOD bars (cron/ops only; user path is snapshot). */
export const maxDuration = 120;

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const { slug } = await params;
  const item = SUPERINVESTOR_REGISTRY.find((entry) => entry.slug === slug);
  if (!item) {
    return NextResponse.json({ error: "Unknown superinvestor" }, { status: 404 });
  }
  if (!isSuperinvestorPerformanceEnabled(slug)) {
    return NextResponse.json(
      { error: "Performance chart is not available for this manager yet" },
      { status: 404 },
    );
  }

  try {
    const data = await loadSuperinvestorPerformanceSeries(slug);
    if (!data) {
      return NextResponse.json(
        {
          error:
            "Performance is still warming up. Wait a moment and try again — the first build pulls SEC filings and prices.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json(data, {
      headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_WARM },
    });
  } catch {
    return NextResponse.json({ error: "Could not load performance" }, { status: 502 });
  }
}
