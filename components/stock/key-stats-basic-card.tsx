"use client";

import { CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";

import { consensusLabelTextClass } from "@/lib/market/analyst-consensus-tone";
import { cn } from "@/lib/utils";

type Row = { label: string; value: string };

function StatRow({ label, value }: { label: string; value: string }) {
  const valueClass =
    label === "Analyst Consensus" && value !== "—" ? consensusLabelTextClass(value) : "text-[#09090B]";
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#E4E4E7] py-1.5 last:border-0">
      <span className="min-w-0 shrink cursor-pointer text-[14px] leading-5 text-[#09090B] underline decoration-[#E4E4E7] underline-offset-2">
        {label}
      </span>
      {label === "Earnings Date" && value !== "—" ? (
        <span className="inline-flex shrink-0 items-center justify-end gap-1.5 text-right">
          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-[#71717A]" strokeWidth={2} aria-hidden />
          <span className={cn("text-[14px] leading-5 tabular-nums", valueClass)}>{value}</span>
        </span>
      ) : (
        <span className={cn("shrink-0 text-right text-[14px] leading-5 tabular-nums", valueClass)}>{value}</span>
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
      { label: "1Y Target Est", value: "—" },
      { label: "Analyst Consensus", value: "—" },
      { label: "Earnings Date", value: "—" },
      { label: "Employees", value: "—" },
    ] satisfies Row[]);

  return (
    <div className="mb-5 rounded-xl border border-[#E4E4E7] bg-white p-4">
      <h3 className="mb-2 text-[14px] font-semibold leading-5 text-[#09090B]">Basic</h3>
      {loading ? (
        <div className="space-y-2 pt-0.5" aria-hidden>
          {displayRows.map((r) => (
            <div key={r.label} className="flex justify-between gap-3 border-b border-[#E4E4E7] py-1.5 last:border-0">
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
