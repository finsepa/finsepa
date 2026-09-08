import { NextResponse } from "next/server";

import { pickProcessEnv } from "@/lib/env/pick-process-env";
import {
  backfillEarningsIrVaultUniverse,
  formatIrVaultChecklistText,
  pullEarningsIrVaultForRecentReports,
} from "@/lib/market/earnings-ir-vault-backfill";
import { EARNINGS_IR_VAULT_TOP_N } from "@/lib/market/earnings-ir-vault-types";
import { usEquitySessionBoundaryPullKind } from "@/lib/market/us-equity-market-session";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorizeCron(request: Request): boolean {
  const secret = pickProcessEnv("CRON_SECRET");
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Phase-1 IR vault:
 * - `?mode=backfill` — full top-N IR-only resolve + checklist JSON
 * - default / `?mode=pull` — names reporting today (NY), at open+1min / close+1min
 * - `?force=1` — run pull even outside the session-boundary window
 */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const mode = url.searchParams.get("mode")?.trim() || "pull";
    const topN = Math.min(
      100,
      Math.max(1, Number(url.searchParams.get("topN") || EARNINGS_IR_VAULT_TOP_N) || EARNINGS_IR_VAULT_TOP_N),
    );
    const text = url.searchParams.get("text") === "1";
    const force = url.searchParams.get("force") === "1";
    const boundary = usEquitySessionBoundaryPullKind();

    if (mode !== "backfill" && !force && !boundary) {
      return NextResponse.json({
        ok: true,
        mode,
        skipped: true,
        boundary: null,
        reason: "not_open_or_close_plus_1min_et",
      });
    }

    const result =
      mode === "backfill"
        ? await backfillEarningsIrVaultUniverse({ topN })
        : await pullEarningsIrVaultForRecentReports({
            topN,
            includePriorSession: boundary === "open" || force,
          });

    if (text) {
      return new NextResponse(formatIrVaultChecklistText(result), {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    return NextResponse.json({
      ok: true,
      mode,
      boundary,
      ...result,
      checklist: formatIrVaultChecklistText(result),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "ir_vault_failed";
    console.error("[cron/earnings-ir-vault]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
