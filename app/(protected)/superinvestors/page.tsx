import {
  getArkHoldings,
  getBaillieGiffordHoldings,
  getBerkshireHoldings,
  getBlackrockHoldings,
  getBridgewaterHoldings,
  getCitadelHoldings,
  getDailyJournalHoldings,
  getFirstEagleHoldings,
  getFisherHoldings,
  getFundsmithHoldings,
  getGmoHoldings,
  getPershingSquareHoldings,
  getPoint72Holdings,
  getPrimecapHoldings,
  getHimalayaHoldings,
  getRenaissanceTechnologiesHoldings,
  getScionHoldings,
  getTciFundHoldings,
} from "@/lib/superinvestors/berkshire-13f";
import {
  SuperinvestorsFundTable,
  type SuperinvestorsFundRowModel,
} from "@/components/superinvestors/superinvestors-fund-table";

export const dynamic = "force-dynamic";

export default async function SuperinvestorsPage() {
  const [
    berkshire,
    pershing,
    fundsmith,
    scion,
    ark,
    himalaya,
    bridgewater,
    fisher,
    primecap,
    citadel,
    dailyJournal,
    blackrock,
    baillieGifford,
    renaissance,
    point72,
    firstEagle,
    tciFund,
    gmo,
  ] = await Promise.all([
    getBerkshireHoldings(),
    getPershingSquareHoldings(),
    getFundsmithHoldings(),
    getScionHoldings(),
    getArkHoldings(),
    getHimalayaHoldings(),
    getBridgewaterHoldings(),
    getFisherHoldings(),
    getPrimecapHoldings(),
    getCitadelHoldings(),
    getDailyJournalHoldings(),
    getBlackrockHoldings(),
    getBaillieGiffordHoldings(),
    getRenaissanceTechnologiesHoldings(),
    getPoint72Holdings(),
    getFirstEagleHoldings(),
    getTciFundHoldings(),
    getGmoHoldings(),
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
    {
      href: "/superinvestors/ken-fisher",
      displayName: "Ken Fisher",
      avatarSrc: "/superinvestors/ken-fisher.png",
      totalValueUsd: fisher.totalValueUsd,
      positionCount: fisher.positionCount,
      filingDate: fisher.filingDate,
      topHoldings: fisher.holdings.slice(0, 5).map((h) => ({
        issuer: h.issuer,
        ticker: h.ticker,
      })),
    },
    {
      href: "/superinvestors/primecap-management",
      displayName: "PRIMECAP Management",
      avatarSrc: "/superinvestors/primecap-management.png",
      totalValueUsd: primecap.totalValueUsd,
      positionCount: primecap.positionCount,
      filingDate: primecap.filingDate,
      topHoldings: primecap.holdings.slice(0, 5).map((h) => ({
        issuer: h.issuer,
        ticker: h.ticker,
      })),
    },
    {
      href: "/superinvestors/ken-griffin",
      displayName: "Ken Griffin",
      avatarSrc: "/superinvestors/ken-griffin.png",
      totalValueUsd: citadel.totalValueUsd,
      positionCount: citadel.positionCount,
      filingDate: citadel.filingDate,
      topHoldings: citadel.holdings.slice(0, 5).map((h) => ({
        issuer: h.issuer,
        ticker: h.ticker,
      })),
    },
    {
      href: "/superinvestors/charlie-munger",
      displayName: "Charlie Munger",
      avatarSrc: "/superinvestors/charlie-munger.png",
      totalValueUsd: dailyJournal.totalValueUsd,
      positionCount: dailyJournal.positionCount,
      filingDate: dailyJournal.filingDate,
      topHoldings: dailyJournal.holdings.slice(0, 5).map((h) => ({
        issuer: h.issuer,
        ticker: h.ticker,
      })),
    },
    {
      href: "/superinvestors/blackrock",
      displayName: "BlackRock",
      avatarSrc: "/superinvestors/blackrock.png",
      totalValueUsd: blackrock.totalValueUsd,
      positionCount: blackrock.positionCount,
      filingDate: blackrock.filingDate,
      topHoldings: blackrock.holdings.slice(0, 5).map((h) => ({
        issuer: h.issuer,
        ticker: h.ticker,
      })),
    },
    {
      href: "/superinvestors/baillie-gifford",
      displayName: "Baillie Gifford",
      avatarSrc: null,
      totalValueUsd: baillieGifford.totalValueUsd,
      positionCount: baillieGifford.positionCount,
      filingDate: baillieGifford.filingDate,
      topHoldings: baillieGifford.holdings.slice(0, 5).map((h) => ({
        issuer: h.issuer,
        ticker: h.ticker,
      })),
    },
    {
      href: "/superinvestors/renaissance-technologies",
      displayName: "Jim Simons",
      avatarSrc: "/superinvestors/jim-simons.png",
      totalValueUsd: renaissance.totalValueUsd,
      positionCount: renaissance.positionCount,
      filingDate: renaissance.filingDate,
      topHoldings: renaissance.holdings.slice(0, 5).map((h) => ({
        issuer: h.issuer,
        ticker: h.ticker,
      })),
    },
    {
      href: "/superinvestors/point72",
      displayName: "Steven Cohen",
      avatarSrc: "/superinvestors/steven-cohen.png",
      totalValueUsd: point72.totalValueUsd,
      positionCount: point72.positionCount,
      filingDate: point72.filingDate,
      topHoldings: point72.holdings.slice(0, 5).map((h) => ({
        issuer: h.issuer,
        ticker: h.ticker,
      })),
    },
    {
      href: "/superinvestors/first-eagle",
      displayName: "First Eagle Investments",
      avatarSrc: null,
      totalValueUsd: firstEagle.totalValueUsd,
      positionCount: firstEagle.positionCount,
      filingDate: firstEagle.filingDate,
      topHoldings: firstEagle.holdings.slice(0, 5).map((h) => ({
        issuer: h.issuer,
        ticker: h.ticker,
      })),
    },
    {
      href: "/superinvestors/chris-hohn",
      displayName: "Chris Hohn",
      avatarSrc: "/superinvestors/chris-hohn.png",
      totalValueUsd: tciFund.totalValueUsd,
      positionCount: tciFund.positionCount,
      filingDate: tciFund.filingDate,
      topHoldings: tciFund.holdings.slice(0, 5).map((h) => ({
        issuer: h.issuer,
        ticker: h.ticker,
      })),
    },
    {
      href: "/superinvestors/jeremy-grantham",
      displayName: "Jeremy Grantham",
      avatarSrc: "/superinvestors/jeremy-grantham.png",
      totalValueUsd: gmo.totalValueUsd,
      positionCount: gmo.positionCount,
      filingDate: gmo.filingDate,
      topHoldings: gmo.holdings.slice(0, 5).map((h) => ({
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
