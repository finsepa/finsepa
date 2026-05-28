"use client";

import type { ReactNode } from "react";
import { memo } from "react";

import type { CryptoAssetRow } from "@/lib/market/crypto-asset";

function StatRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#E4E4E7] py-1.5 last:border-0">
      <span className="min-w-0 shrink text-[14px] leading-5 text-[#09090B]">{label}</span>
      <span className="shrink-0 text-right text-[14px] leading-5 tabular-nums text-[#09090B]">{value}</span>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-white p-4">
      <h3 className="mb-2 text-[14px] font-semibold leading-5 text-[#09090B]">{title}</h3>
      {children}
    </div>
  );
}

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
      <h2 className="mb-4 text-[18px] font-semibold leading-7 text-[#09090B]">Key Stats</h2>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <Card title="General">
          <StatRow label="Market Cap" value={usdFigure(row.marketCap || "—")} />
          <StatRow label="Fully Diluted Market Cap" value={usdFigure(row.fullyDilutedMarketCap)} />
          <StatRow label="ATH Market Cap" value={usdFigure(row.athMarketCap)} />
        </Card>

        <Card title="Supply">
          <StatRow label="Total Supply" value={supplyWithTicker(sym, row.totalSupply)} />
          <StatRow label="Circ. Supply" value={supplyWithTicker(sym, row.circulatingSupply)} />
          <StatRow label="Max Supply" value={formatMaxSupply(sym, row.maxSupply)} />
        </Card>

        <Card title="Volume">
          <StatRow label="Volume (24h)" value={usdFigure(row.volume24h)} />
          <StatRow label="Volume/Market cap (24h)" value={row.volumeToMarketCap24h} />
        </Card>
      </div>
    </div>
  );
}

export const CryptoKeyStats = memo(CryptoKeyStatsInner);
