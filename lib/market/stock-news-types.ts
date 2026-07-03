export type StockNewsArticle = {
  id: string;
  title: string;
  source: string;
  /** ISO 8601 from provider */
  publishedAt: string;
  summary: string;
  imageUrl: string | null;
  url: string;
  tags: string[];
};

export type StockNewsResponse = {
  ticker: string;
  items: StockNewsArticle[];
  /** When `items.length === requested limit`, client may request the next `offset`. */
  hasMore?: boolean;
};

/** First-page size for stock overview news + infinite scroll batches. */
export const STOCK_NEWS_PAGE_SIZE = 6;

/** Mobile asset overview — horizontal news carousel length. */
export const MOBILE_NEWS_CAROUSEL_COUNT = 5;
