/**
 * Web crypto chart loading: stock-style range strategies + HOT cache lifecycle on `.CC` pairs,
 * with US equity RTH / session filters disabled (24/7 UTC semantics).
 *
 * Live 1D allowlist (BTC/ETH) still uses the crypto live-24H path for range=1D only.
 *
 * Kill switch: `NEXT_PUBLIC_CRYPTO_STOCK_PIPELINE_EXPERIMENT=0`
 * (default: on for the full crypto web universe)
 *
 * Client-safe — no server-only imports.
 */
import { normalizeCryptoBaseSymbol } from "@/lib/market/crypto-live-1d-tickers";

/** Default on; set env to `"0"` to disable and fall back to legacy crypto chart loaders. */
export function isCryptoStockPipelineExperimentEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CRYPTO_STOCK_PIPELINE_EXPERIMENT !== "0";
}

/**
 * True for any crypto detail route symbol when the stock-style pipeline is enabled.
 * Only call from crypto page / crypto chart API paths.
 */
export function usesCryptoStockPipelineExperiment(symbol: string): boolean {
  if (!isCryptoStockPipelineExperimentEnabled()) return false;
  return normalizeCryptoBaseSymbol(symbol).length > 0;
}
