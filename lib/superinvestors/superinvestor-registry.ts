import type { Berkshire13fComparisonPayload } from "@/lib/superinvestors/types";
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

export type SuperinvestorRegistryItem = {
  slug: string;
  managerName: string;
  fundNameOverride?: string;
  avatarSrc: string | null;
  load: () => Promise<Berkshire13fComparisonPayload>;
};

/** Tracked 13F filers shown on stock Superinvestors tab and `/superinvestors` profiles. */
export const SUPERINVESTOR_REGISTRY: SuperinvestorRegistryItem[] = [
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
