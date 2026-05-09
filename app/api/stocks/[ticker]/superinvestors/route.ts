import { NextResponse } from "next/server";

import { getStockDetailHeaderMetaForPage } from "@/lib/market/stock-header-meta-server";
import {
  getArkHoldingsComparison,
  getBaillieGiffordHoldingsComparison,
  getBerkshireHoldingsComparison,
  getBlackrockHoldingsComparison,
  getBridgewaterHoldingsComparison,
  getCitadelHoldingsComparison,
  getDailyJournalHoldingsComparison,
  getFirstEagleHoldingsComparison,
  getFisherHoldingsComparison,
  getFundsmithHoldingsComparison,
  getGmoHoldingsComparison,
  getHimalayaHoldingsComparison,
  getPershingSquareHoldingsComparison,
  getPoint72HoldingsComparison,
  getPrimecapHoldingsComparison,
  getRenaissanceTechnologiesHoldingsComparison,
  getScionHoldingsComparison,
  getTciFundHoldingsComparison,
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
  {
    slug: "ken-fisher",
    managerName: "Ken Fisher",
    avatarSrc: "/superinvestors/ken-fisher.png",
    load: getFisherHoldingsComparison,
  },
  {
    slug: "primecap-management",
    managerName: "PRIMECAP Management",
    avatarSrc: "/superinvestors/primecap-management.png",
    load: getPrimecapHoldingsComparison,
  },
  {
    slug: "ken-griffin",
    managerName: "Ken Griffin",
    avatarSrc: "/superinvestors/ken-griffin.png",
    load: getCitadelHoldingsComparison,
  },
  {
    slug: "charlie-munger",
    managerName: "Charlie Munger",
    fundNameOverride: "Daily Journal Holdings",
    avatarSrc: "/superinvestors/charlie-munger.png",
    load: getDailyJournalHoldingsComparison,
  },
  {
    slug: "blackrock",
    managerName: "BlackRock",
    avatarSrc: "/superinvestors/blackrock.png",
    load: getBlackrockHoldingsComparison,
  },
  {
    slug: "baillie-gifford",
    managerName: "Baillie Gifford",
    fundNameOverride: "Baillie Gifford & Co Holdings",
    avatarSrc: null,
    load: getBaillieGiffordHoldingsComparison,
  },
  {
    slug: "renaissance-technologies",
    managerName: "Jim Simons",
    fundNameOverride: "Renaissance Technologies Holdings",
    avatarSrc: "/superinvestors/jim-simons.png",
    load: getRenaissanceTechnologiesHoldingsComparison,
  },
  {
    slug: "point72",
    managerName: "Steven Cohen",
    fundNameOverride: "Point72 Asset Management Holdings",
    avatarSrc: "/superinvestors/steven-cohen.png",
    load: getPoint72HoldingsComparison,
  },
  {
    slug: "first-eagle",
    managerName: "First Eagle Investments",
    fundNameOverride: "First Eagle Investment Management LLC",
    avatarSrc: null,
    load: getFirstEagleHoldingsComparison,
  },
  {
    slug: "chris-hohn",
    managerName: "Chris Hohn",
    fundNameOverride: "TCI Fund Management",
    avatarSrc: "/superinvestors/chris-hohn.png",
    load: getTciFundHoldingsComparison,
  },
  {
    slug: "jeremy-grantham",
    managerName: "Jeremy Grantham",
    fundNameOverride: "GMO Asset Management",
    avatarSrc: "/superinvestors/jeremy-grantham.png",
    load: getGmoHoldingsComparison,
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

  const positions = (
    await Promise.all(
      payloads.map(async ({ s, data }) => {
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

        return {
          superinvestorSlug: s.slug,
          managerName: s.managerName,
          fundName: s.fundNameOverride ?? data.filerDisplayName,
          avatarSrc: s.avatarSrc,
          weightPct: row.weight,
          statusLabel: activityLabel(row.status, row.sharesChangePct),
          shares: row.shares,
          valueUsd: row.valueUsd,
        };
      }),
    )
  ).filter(Boolean);

  return NextResponse.json({ ticker: sym, positions });
}

