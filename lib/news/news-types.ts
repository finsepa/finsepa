export type NewsTab = "stocks" | "crypto" | "indices";

export type NewsItem = {
  id: string;
  title: string;
  url: string | null;
  source: string;
  publishedAt: string; // ISO
  assetLabel: string; // e.g. "NVIDIA Corporation"
  assetSymbol: string; // e.g. "NVDA", "BTC", "GSPC.INDX"
  assetType: NewsTab;
};

export type NewsResponse = {
  tab: NewsTab;
  page: number;
  pageSize: number;
  total: number;
  items: NewsItem[];
};

