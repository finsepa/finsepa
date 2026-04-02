import { companyLogoUrlFromDomain } from "@/lib/screener/company-logo-url";
import { TOP10_META } from "@/lib/screener/top10-config";
import type { ScreenerTableRow } from "@/lib/screener/screener-static";

type MockRow = {
  ticker: string;
  name: string;
  price: number;
  changePercent1D: number;
  changePercent1M: number;
  changePercentYTD: number;
  marketCap: number | null;
  peRatio: number | null;
  trend: number[];
  logoUrl: string;
};

const MOCK_ROWS: MockRow[] = [
  {
    ticker: "NVDA",
    name: "NVIDIA",
    price: 880,
    changePercent1D: 1.2,
    changePercent1M: 5.5,
    changePercentYTD: 22,
    marketCap: 2_200_000_000_000,
    peRatio: 65,
    trend: [855, 860, 868, 872, 878, 880, 886],
    logoUrl: companyLogoUrlFromDomain(TOP10_META.NVDA.domain),
  },
  {
    ticker: "AAPL",
    name: "Apple",
    price: 210,
    changePercent1D: -0.8,
    changePercent1M: -2.1,
    changePercentYTD: 10,
    marketCap: 3_200_000_000_000,
    peRatio: 30,
    trend: [205, 206, 207, 208, 209, 210, 211],
    logoUrl: "",
  },
];

function toRow(r: MockRow, id: number): ScreenerTableRow {
  return {
    id,
    name: r.name,
    ticker: r.ticker,
    logoUrl: r.logoUrl,
    price: r.price,
    change1D: r.changePercent1D,
    change1M: r.changePercent1M,
    changeYTD: r.changePercentYTD,
    marketCap: r.marketCap == null ? "-" : String(r.marketCap),
    pe: r.peRatio == null ? "-" : String(r.peRatio),
    trend: r.trend,
  };
}

export function getMockScreenerCompaniesNvdaBtcRows(): ScreenerTableRow[] {
  return MOCK_ROWS.map((r, i) => toRow(r, i + 1));
}

