import {
  getBerkshireHoldings,
  getFundsmithHoldings,
  getPershingSquareHoldings,
} from "@/lib/superinvestors/berkshire-13f";
import {
  SuperinvestorsFundTable,
  type SuperinvestorsFundRowModel,
} from "@/components/superinvestors/superinvestors-fund-table";

export const dynamic = "force-dynamic";

export default async function SuperinvestorsPage() {
  const [berkshire, pershing, fundsmith] = await Promise.all([
    getBerkshireHoldings(),
    getPershingSquareHoldings(),
    getFundsmithHoldings(),
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
  ];

  return (
    <div className="px-9 py-6">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-[#09090B]">Superinvestors</h1>
      <SuperinvestorsFundTable rows={rows} />
    </div>
  );
}
