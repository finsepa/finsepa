import {
  getArkHoldings,
  getBerkshireHoldings,
  getBridgewaterHoldings,
  getFundsmithHoldings,
  getPershingSquareHoldings,
  getHimalayaHoldings,
  getScionHoldings,
} from "@/lib/superinvestors/berkshire-13f";
import {
  SuperinvestorsFundTable,
  type SuperinvestorsFundRowModel,
} from "@/components/superinvestors/superinvestors-fund-table";

export const dynamic = "force-dynamic";

export default async function SuperinvestorsPage() {
  const [berkshire, pershing, fundsmith, scion, ark, himalaya, bridgewater] = await Promise.all([
    getBerkshireHoldings(),
    getPershingSquareHoldings(),
    getFundsmithHoldings(),
    getScionHoldings(),
    getArkHoldings(),
    getHimalayaHoldings(),
    getBridgewaterHoldings(),
  ]);

  const rows: SuperinvestorsFundRowModel[] = [
    {
      href: "/superinvestors/berkshire-hathaway",
      displayName: "Warren Buffett",
      avatarSrc: "/superinvestors/warren-buffett.png",
      totalValueUsd: berkshire.totalValueUsd,
      positionCount: berkshire.positionCount,
      filingDate: berkshire.filingDate,
      topHoldings: berkshire.holdings.slice(0, 5).map((h) => ({
        issuer: h.issuer,
        ticker: h.ticker,
      })),
    },
    {
      href: "/superinvestors/michael-burry",
      displayName: "Michael Burry",
      avatarSrc: "/superinvestors/michael-burry.png",
      totalValueUsd: scion.totalValueUsd,
      positionCount: scion.positionCount,
      filingDate: scion.filingDate,
      topHoldings: scion.holdings.slice(0, 5).map((h) => ({
        issuer: h.issuer,
        ticker: h.ticker,
      })),
    },
    {
      href: "/superinvestors/bill-ackman",
      displayName: "Bill Ackman",
      avatarSrc: "/superinvestors/bill-ackman.png",
      totalValueUsd: pershing.totalValueUsd,
      positionCount: pershing.positionCount,
      filingDate: pershing.filingDate,
      topHoldings: pershing.holdings.slice(0, 5).map((h) => ({
        issuer: h.issuer,
        ticker: h.ticker,
      })),
    },
    {
      href: "/superinvestors/cathie-wood",
      displayName: "Cathie Wood",
      avatarSrc: "/superinvestors/cathie-wood.png",
      totalValueUsd: ark.totalValueUsd,
      positionCount: ark.positionCount,
      filingDate: ark.filingDate,
      topHoldings: ark.holdings.slice(0, 5).map((h) => ({
        issuer: h.issuer,
        ticker: h.ticker,
      })),
    },
    {
      href: "/superinvestors/terry-smith",
      displayName: "Terry Smith",
      avatarSrc: "/superinvestors/terry-smith.png",
      totalValueUsd: fundsmith.totalValueUsd,
      positionCount: fundsmith.positionCount,
      filingDate: fundsmith.filingDate,
      topHoldings: fundsmith.holdings.slice(0, 5).map((h) => ({
        issuer: h.issuer,
        ticker: h.ticker,
      })),
    },
    {
      href: "/superinvestors/li-lu",
      displayName: "Li Lu",
      avatarSrc: "/superinvestors/li-lu.png",
      totalValueUsd: himalaya.totalValueUsd,
      positionCount: himalaya.positionCount,
      filingDate: himalaya.filingDate,
      topHoldings: himalaya.holdings.slice(0, 5).map((h) => ({
        issuer: h.issuer,
        ticker: h.ticker,
      })),
    },
    {
      href: "/superinvestors/ray-dalio",
      displayName: "Ray Dalio",
      avatarSrc: "/superinvestors/ray-dalio.png",
      totalValueUsd: bridgewater.totalValueUsd,
      positionCount: bridgewater.positionCount,
      filingDate: bridgewater.filingDate,
      topHoldings: bridgewater.holdings.slice(0, 5).map((h) => ({
        issuer: h.issuer,
        ticker: h.ticker,
      })),
    },
  ];

  rows.sort((a, b) => b.totalValueUsd - a.totalValueUsd);

  return (
    <div className="min-w-0 px-4 py-4 sm:px-9 sm:py-6">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-[#09090B]">Superinvestors</h1>
      <SuperinvestorsFundTable rows={rows} />
    </div>
  );
}
