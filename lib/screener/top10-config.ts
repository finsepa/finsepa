/** Fixed screener universe — order is display rank. */
export const TOP10_TICKERS = [
  "AAPL",
  "MSFT",
  "NVDA",
  "GOOGL",
  "AMZN",
  "META",
  "BRK-B",
  "TSM",
  "LLY",
  "TSLA",
] as const;

export type Top10Ticker = (typeof TOP10_TICKERS)[number];

export function isTop10Ticker(t: string): t is Top10Ticker {
  return (TOP10_TICKERS as readonly string[]).includes(t);
}

export type Top10CompanyMeta = {
  name: string;
  domain: string;
};

export const TOP10_META: Record<Top10Ticker, Top10CompanyMeta> = {
  AAPL: { name: "Apple", domain: "apple.com" },
  MSFT: { name: "Microsoft", domain: "microsoft.com" },
  NVDA: { name: "NVIDIA", domain: "nvidia.com" },
  GOOGL: { name: "Alphabet", domain: "google.com" },
  AMZN: { name: "Amazon", domain: "amazon.com" },
  META: { name: "Meta Platforms", domain: "meta.com" },
  "BRK-B": { name: "Berkshire Hathaway", domain: "berkshirehathaway.com" },
  TSM: { name: "TSMC", domain: "tsmc.com" },
  LLY: { name: "Eli Lilly", domain: "lilly.com" },
  TSLA: { name: "Tesla", domain: "tesla.com" },
};
