"use client";

import { memo } from "react";

import {
  STOCK_OVERVIEW_SECTION_HEADING_CLASS,
  STOCK_OVERVIEW_SECTION_TITLE_CLASS,
} from "@/components/design-system/card-surface-styles";
import { KEY_STATS_CARD_CLASS, StatRow } from "@/components/stock/key-stats";
import type { CryptoAssetRow } from "@/lib/market/crypto-asset";
import { cn } from "@/lib/utils";

/** Display stored USD-ish strings with a leading $ when missing (API strips $ for some fields). */
function usdFigure(raw: string): string {
  const v = raw.trim();
  if (!v || v === "—" || v === "-") return "—";
  if (v.startsWith("$")) return v;
  return `$${v}`;
}

/** Prefix supply figures with ticker (e.g. SOL 585,384,521) when value is present. */
function supplyWithTicker(ticker: string, raw: string): string {
  const v = raw.trim();
  if (!v || v === "—" || v === "-") return "—";
  if (v === "∞" || /^∞/u.test(v)) return v;
  const sym = ticker.trim().toUpperCase();
  if (v.toUpperCase().startsWith(`${sym} `)) return v;
  return `${sym} ${v}`;
}

function formatMaxSupply(ticker: string, raw: string): string {
  const v = raw.trim();
  if (!v || v === "—" || v === "-") return "—";
  if (v === "∞" || /^∞/u.test(v) || v.toLowerCase() === "infinity") return "∞";
  return supplyWithTicker(ticker, v);
}

function CryptoKeyStatsInner({ row }: { row: CryptoAssetRow }) {
  const sym = row.symbol.trim().toUpperCase();

  return (
    <div>
      <h2 className={cn("mb-4", STOCK_OVERVIEW_SECTION_HEADING_CLASS)}>Key Stats</h2>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <div className={KEY_STATS_CARD_CLASS}>
          <h3 className={cn("mb-2", STOCK_OVERVIEW_SECTION_TITLE_CLASS)}>General</h3>
          <StatRow label="Market Cap" value={usdFigure(row.marketCap || "—")} />
          <StatRow label="Fully Diluted Market Cap" value={usdFigure(row.fullyDilutedMarketCap)} />
        </div>

        <div className={KEY_STATS_CARD_CLASS}>
          <h3 className={cn("mb-2", STOCK_OVERVIEW_SECTION_TITLE_CLASS)}>Supply</h3>
          <StatRow label="Total Supply" value={supplyWithTicker(sym, row.totalSupply)} />
          <StatRow label="Circ. Supply" value={supplyWithTicker(sym, row.circulatingSupply)} />
          <StatRow label="Max Supply" value={formatMaxSupply(sym, row.maxSupply)} />
        </div>

        <div className={KEY_STATS_CARD_CLASS}>
          <h3 className={cn("mb-2", STOCK_OVERVIEW_SECTION_TITLE_CLASS)}>Volume</h3>
          <StatRow label="Volume (24h)" value={usdFigure(row.volume24h)} />
          <StatRow label="Volume/Market cap (24h)" value={row.volumeToMarketCap24h} />
        </div>
      </div>
    </div>
  );
}

export const CryptoKeyStats = memo(CryptoKeyStatsInner);
