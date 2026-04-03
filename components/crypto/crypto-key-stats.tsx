"use client";

import type { ReactNode } from "react";
import { memo } from "react";

import type { CryptoAssetRow } from "@/lib/market/crypto-asset";

function StatRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-dotted border-[#E4E4E7] py-2.5 last:border-b-0 last:pb-0">
      <span className="min-w-0 shrink text-[13px] font-medium leading-5 text-[#71717A]">{label}</span>
      <span className="max-w-[min(100%,14rem)] shrink-0 text-right text-[14px] font-semibold leading-5 tabular-nums tracking-tight text-[#09090B] sm:max-w-none">
        {value}
      </span>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-[#E4E4E7] bg-white px-4 py-4 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)]">
      <h3 className="mb-3 text-[14px] font-semibold leading-5 text-[#09090B]">{title}</h3>
      <div className="space-y-0">{children}</div>
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
      <h2 className="mb-5 text-[18px] font-semibold leading-7 tracking-tight text-[#09090B]">Key Stats</h2>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6">
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
