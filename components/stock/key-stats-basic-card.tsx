"use client";

import { useEffect, useState } from "react";

type Row = { label: string; value: string };

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#E4E4E7] py-1.5 last:border-0">
      <span className="min-w-0 shrink cursor-pointer text-[14px] leading-5 text-[#09090B] underline decoration-[#E4E4E7] underline-offset-2">
        {label}
      </span>
      <span className="shrink-0 text-right text-[14px] leading-5 text-[#09090B] tabular-nums">{value}</span>
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
      { label: "Fair Value", value: "—" },
      { label: "Earnings Date", value: "—" },
      { label: "Beta (5Y Monthly)", value: "—" },
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
