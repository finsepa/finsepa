import { countryFlagEmoji } from "@/lib/market/economy-format-display";

/** Normalized company metadata for the stock detail header (API + UI). */
export type StockDetailHeaderMeta = {
  /** Official full company name when available (e.g. "NVIDIA Corporation"). */
  fullName: string | null;
  /** Domain favicon URL derived from fundamentals website (may be null). */
  logoUrl: string | null;
  /** Listing exchange short name (e.g. `NASDAQ`, `NYSE`) from fundamentals `General.Exchange`. */
  exchange: string | null;
  /** ISO 3166-1 alpha-2 (e.g. `US`) from fundamentals `General.CountryISO` when available. */
  countryIso: string | null;
  sector: string | null;
  industry: string | null;
  earningsDateDisplay: string | null;
  /** Global count of watchlist rows for this plain ticker; null if unavailable. */
  watchlistCount: number | null;
};

const US_LISTING_EXCHANGES = new Set([
  "NASDAQ",
  "NYSE",
  "AMEX",
  "BATS",
  "OTC",
  "US",
  "NYSE ARCA",
  "NYSE MKT",
  "ARCA",
]);

function normalizeCountryIso(raw: string | null | undefined): string | null {
  const v = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  if (!v) return null;
  if (v === "USA") return "US";
  if (/^[A-Z]{2}$/.test(v)) return v;
  return null;
}

export function inferListingCountryIso(exchange: string | null | undefined): string | null {
  const ex = typeof exchange === "string" ? exchange.trim().toUpperCase() : "";
  if (!ex) return null;
  if (US_LISTING_EXCHANGES.has(ex)) return "US";
  if (ex.includes("NASDAQ") || ex.includes("NYSE") || ex.startsWith("OTC")) return "US";
  return null;
}

export type StockListingSubtitleParts = {
  ticker: string;
  exchange: string | null;
  countryFlag: string | null;
};

export function getStockListingSubtitleParts(args: {
  ticker: string;
  exchange: string | null | undefined;
  countryIso?: string | null | undefined;
}): StockListingSubtitleParts {
  const ticker = args.ticker.trim().toUpperCase();
  const exchange = typeof args.exchange === "string" ? args.exchange.trim() : "";
  const country = normalizeCountryIso(args.countryIso) ?? inferListingCountryIso(exchange);
  return {
    ticker,
    exchange: exchange || null,
    countryFlag: country ? countryFlagEmoji(country) : null,
  };
}

/** Mobile top bar line 2 — e.g. `NASDAQ · 🇺🇸` (ticker is line 1). */
export function formatStockTopbarSecondaryLine(parts: {
  exchange: string | null;
  countryFlag: string | null;
}): string | null {
  const segments: string[] = [];
  if (parts.exchange) segments.push(parts.exchange);
  if (parts.countryFlag) segments.push(parts.countryFlag);
  return segments.length > 0 ? segments.join(" · ") : null;
}

/** True when the listing is treated as a US equity (extended-hours header eligible). */
export function isUsListedStockHeaderMeta(
  meta: Pick<StockDetailHeaderMeta, "exchange" | "countryIso"> | null,
): boolean {
  if (!meta) return true;
  const iso = normalizeCountryIso(meta.countryIso);
  if (iso === "US") return true;
  return inferListingCountryIso(meta.exchange) === "US";
}

export function formatStockListingSubtitle(args: {
  ticker: string;
  exchange: string | null | undefined;
  countryIso?: string | null | undefined;
}): string {
  const { ticker, exchange, countryFlag } = getStockListingSubtitleParts(args);
  const parts: string[] = [ticker];
  if (exchange) parts.push(exchange);
  if (countryFlag) parts.push(countryFlag);
  return parts.join(" · ");
}

export function formatHeaderMetaSegment(value: string | null | undefined): string {
  const v = typeof value === "string" ? value.trim() : "";
  return v ? v : "-";
}

export function formatWatchlistsCountLabel(count: number | null): string {
  if (count == null) return "-";
  if (count === 0) return "0 Watchlists";
  return `${count.toLocaleString("en-US")} Watchlists`;
}
