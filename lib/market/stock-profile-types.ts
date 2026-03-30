/** Company profile fields from EODHD fundamentals (client + server safe). */
export type StockProfilePayload = {
  description: string | null;
  website: string | null;
  irWebsite: string | null;
  foundedYear: string | null;
  headquarters: string | null;
  hqState: string | null;
  sector: string | null;
  industry: string | null;
  employees: string | null;
  phone: string | null;
  equityStyle: string | null;
  nextEarningsDate: string | null;
  lastEarningsDate: string | null;
};
