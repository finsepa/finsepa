import type { CryptoTop10Row } from "@/lib/market/crypto-top10";

/** 1D % placeholders for top crypto when live derived quotes are missing (display-only). */
const CHANGE_1D_BY_SYMBOL: Record<string, number> = {
  BTC: 1.82,
  ETH: -0.54,
  XRP: 2.11,
  BNB: 0.38,
  SOL: 3.25,
  DOGE: -1.92,
  ADA: 0.71,
  TRX: 0.15,
  LINK: 1.44,
  AVAX: -0.88,
};

const PRICE_BY_SYMBOL: Record<string, number> = {
  BTC: 97842.5,
  ETH: 3456.2,
  XRP: 2.45,
  BNB: 612.8,
  SOL: 178.4,
  DOGE: 0.18,
  ADA: 0.72,
  TRX: 0.24,
  LINK: 14.85,
  AVAX: 38.2,
};

const NAME_BY_SYMBOL: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  XRP: "XRP",
  BNB: "BNB",
  SOL: "Solana",
  DOGE: "Dogecoin",
  ADA: "Cardano",
  TRX: "TRON",
  LINK: "Chainlink",
  AVAX: "Avalanche",
};

export function withCryptoMoverLocalFallbacks(rows: CryptoTop10Row[]): CryptoTop10Row[] {
  return rows.map((r) => {
    const sym = r.symbol.trim().toUpperCase();
    const changePercent1D =
      r.changePercent1D != null && Number.isFinite(r.changePercent1D)
        ? r.changePercent1D
        : (CHANGE_1D_BY_SYMBOL[sym] ?? null);
    const price =
      r.price != null && Number.isFinite(r.price) ? r.price : (PRICE_BY_SYMBOL[sym] ?? null);
    return {
      ...r,
      name: r.name || NAME_BY_SYMBOL[sym] || sym,
      price,
      changePercent1D,
    };
  });
}

export function cryptoMoverFallbackRows(): CryptoTop10Row[] {
  return Object.keys(CHANGE_1D_BY_SYMBOL).map((symbol) => ({
    symbol,
    name: NAME_BY_SYMBOL[symbol] ?? symbol,
    price: PRICE_BY_SYMBOL[symbol] ?? null,
    changePercent1D: CHANGE_1D_BY_SYMBOL[symbol] ?? null,
    changePercent1M: null,
    changePercentYTD: null,
    marketCap: "—",
    sparkline5d: [],
    logoUrl: "",
  }));
}
