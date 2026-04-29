import { NextResponse } from "next/server";

import { getStockDetailHeaderMetaForPage } from "@/lib/market/stock-header-meta-server";
import {
  getArkHoldingsComparison,
  getBerkshireHoldingsComparison,
  getBridgewaterHoldingsComparison,
  getFundsmithHoldingsComparison,
  getHimalayaHoldingsComparison,
  getPershingSquareHoldingsComparison,
  getScionHoldingsComparison,
} from "@/lib/superinvestors/berkshire-13f";

type SuperinvestorRegistryItem = {
  slug: string;
  managerName: string;
  fundNameOverride?: string;
  avatarSrc: string | null;
  load: () => Promise<Awaited<ReturnType<typeof getBerkshireHoldingsComparison>>>;
};

const SUPERINVESTORS: SuperinvestorRegistryItem[] = [
  {
    slug: "berkshire-hathaway",
    managerName: "Warren Buffett",
    avatarSrc: "/superinvestors/warren-buffett.png",
    load: getBerkshireHoldingsComparison,
  },
  {
    slug: "bill-ackman",
    managerName: "Bill Ackman",
    avatarSrc: "/superinvestors/bill-ackman.png",
    load: getPershingSquareHoldingsComparison,
  },
  {
    slug: "terry-smith",
    managerName: "Terry Smith",
    avatarSrc: "/superinvestors/terry-smith.png",
    load: getFundsmithHoldingsComparison,
  },
  {
    slug: "michael-burry",
    managerName: "Michael Burry",
    avatarSrc: "/superinvestors/michael-burry.png",
    load: getScionHoldingsComparison,
  },
  {
    slug: "cathie-wood",
    managerName: "Cathie Wood",
    avatarSrc: "/superinvestors/cathie-wood.png",
    load: getArkHoldingsComparison,
  },
  {
    slug: "li-lu",
    managerName: "Li Lu",
    avatarSrc: "/superinvestors/li-lu.png",
    load: getHimalayaHoldingsComparison,
  },
  {
    slug: "ray-dalio",
    managerName: "Ray Dalio",
    avatarSrc: "/superinvestors/ray-dalio.png",
    load: getBridgewaterHoldingsComparison,
  },
];

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(inc|incorporated|corp|corporation|co|company|ltd|limited|plc|del|holdings)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function activityLabel(status: string | null, sharesChangePct: number | null): string | null {
  if (!status) return null;
  if (status === "new") return "New";
  if (status === "unchanged") return "Unchanged";
  const pct =
    sharesChangePct != null && Number.isFinite(sharesChangePct) ? Math.abs(sharesChangePct).toFixed(2) : null;
  if (status === "add") return pct ? `Increased ${pct}%` : "Increased";
  if (status === "reduce") return pct ? `Reduced ${pct}%` : "Reduced";
  return null;
}

export async function GET(_req: Request, ctx: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await ctx.params;
  const sym = decodeURIComponent(ticker).trim().toUpperCase();
  if (!sym) {
    return NextResponse.json({ ticker: "", positions: [] });
  }

  const header = await getStockDetailHeaderMetaForPage(sym);
  const targetNameNorm = header.fullName ? normalizeName(header.fullName) : null;

  const payloads = await Promise.all(
    SUPERINVESTORS.map(async (s) => {
      try {
        return { s, data: await s.load() };
      } catch {
        return { s, data: null };
      }
    }),
  );

  const positions = payloads
    .map(({ s, data }) => {
      if (!data || data.source === "unavailable") return null;
      const direct = data.rows.find((r) => (r.ticker ?? "").trim().toUpperCase() === sym) ?? null;
      const byName =
        !direct && targetNameNorm
          ? data.rows.find((r) => {
              const n = normalizeName(r.companyName);
              return n && (n === targetNameNorm || n.includes(targetNameNorm) || targetNameNorm.includes(n));
            }) ?? null
          : null;

      const row = direct ?? byName;
      if (!row) return null;

      const holdSinceYmd =
        row.previousShares != null && data.previous?.reportDate?.trim()
          ? data.previous.reportDate
          : data.current.reportDate ?? null;

      return {
        superinvestorSlug: s.slug,
        managerName: s.managerName,
        fundName: s.fundNameOverride ?? data.filerDisplayName,
        avatarSrc: s.avatarSrc,
        weightPct: row.weight,
        statusLabel: activityLabel(row.status, row.sharesChangePct),
        shares: row.shares,
        valueUsd: row.valueUsd,
        holdSinceYmd,
      };
    })
    .filter(Boolean);

  return NextResponse.json({ ticker: sym, positions });
}

