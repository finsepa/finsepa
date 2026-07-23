"use client";

import { CalendarDays } from "@/lib/icons";
import { useEffect, useState } from "react";

import { STOCK_OVERVIEW_SECTION_TITLE_CLASS } from "@/components/design-system/card-surface-styles";
import { consensusLabelTextClass } from "@/lib/market/analyst-consensus-tone";
import { cn } from "@/lib/utils";

type Row = { label: string; value: string };

/** 4px dash / 4px gap divider (CSS `border-dashed` at 1px looks solid) — #E4E4E7 at 100%. */
const DASHED_ROW_DIVIDER_CLASS =
  "relative after:absolute after:inset-x-0 after:bottom-0 after:h-px after:[background-image:repeating-linear-gradient(90deg,#E4E4E7_0,#E4E4E7_4px,transparent_4px,transparent_8px)] last:after:hidden";

function StatRow({ label, value }: { label: string; value: string }) {
  const valueClass =
    label === "Analyst Consensus" && value !== "—" ? consensusLabelTextClass(value) : "text-[#0F0F0F]";
  return (
    <div className={cn("flex items-center justify-between gap-3 py-1.5", DASHED_ROW_DIVIDER_CLASS)}>
      <span className="min-w-0 shrink cursor-pointer text-[14px] leading-5 text-[#0F0F0F] underline decoration-[#E4E4E7] underline-offset-2">
        {label}
      </span>
      {label === "Earnings Date" && value !== "—" ? (
        <span className="inline-flex shrink-0 items-center justify-end gap-1.5 text-right">
          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-[#71717A]" strokeWidth={2} aria-hidden />
        <span className={cn("text-[14px] font-medium leading-5 tabular-nums", valueClass)}>{value}</span>
        </span>
      ) : (
        <span className={cn("shrink-0 text-right text-[14px] font-medium leading-5 tabular-nums", valueClass)}>{value}</span>
      )}
    </div>
  );
}

export function KeyStatsBasicCard({ ticker }: { ticker: string }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/stocks/${encodeURIComponent(ticker)}/key-stats-basic`, {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok) {
          if (!cancelled) setRows(null);
          return;
        }
        const json = (await res.json()) as { rows?: Row[] | null };
        if (!cancelled) setRows(Array.isArray(json.rows) ? json.rows : null);
      } catch {
        if (!cancelled) setRows(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  const displayRows =
    rows ??
    ([
      { label: "Market Cap", value: "—" },
      { label: "Enterprise Value", value: "—" },
      { label: "Shares Outstanding", value: "—" },
      { label: "% of Insiders", value: "—" },
      { label: "Short Float", value: "—" },
      { label: "1Y Target Est", value: "—" },
      { label: "Analyst Consensus", value: "—" },
      { label: "Earnings Date", value: "—" },
      { label: "Employees", value: "—" },
    ] satisfies Row[]);

  return (
    <div className="mb-5 rounded-xl border border-[#E4E4E7] bg-white p-4">
      <h3 className={cn("mb-2", STOCK_OVERVIEW_SECTION_TITLE_CLASS)}>Basic</h3>
      {loading ? (
        <div className="space-y-2 pt-0.5" aria-hidden>
          {displayRows.map((r) => (
            <div key={r.label} className={cn("flex justify-between gap-3 py-1.5", DASHED_ROW_DIVIDER_CLASS)}>
              <div className="h-4 w-28 rounded bg-neutral-100" />
              <div className="h-4 w-20 rounded bg-neutral-100" />
            </div>
          ))}
        </div>
      ) : (
        displayRows.map((row) => <StatRow key={row.label} label={row.label} value={row.value} />)
      )}
    </div>
  );
}
