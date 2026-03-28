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
};
