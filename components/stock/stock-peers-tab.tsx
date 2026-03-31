"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, Search } from "lucide-react";

import type { SearchAssetItem } from "@/lib/search/search-types";
import { CompanyLogo } from "@/components/screener/company-logo";
import { getStockDetailMetaFromTicker } from "@/lib/market/stock-detail-meta";

type CompareRow = {
  ticker: string;
  fullName: string | null;
  logoUrl: string | null;
  revGrowth: string;
  grossProfit: string;
  operIncome: string;
  netIncome: string;
  eps: string;
  epsGrowth: string;
  revenue: string;
};

function PeerChip({
  ticker,
  name,
  logoUrl,
  removable,
  onRemove,
}: {
  ticker: string;
  name: string;
  logoUrl: string | null;
  removable: boolean;
  onRemove?: () => void;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[#E4E4E7] bg-white py-1 pl-1.5 pr-2 text-[12px] font-medium text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)]">
      <CompanyLogo name={name} logoUrl={(logoUrl ?? "").trim()} />
      <span className="tabular-nums">{ticker}</span>
      {removable ? (
        <button
          type="button"
          onClick={onRemove}
          className="flex h-6 w-6 items-center justify-center rounded-full text-[#A1A1AA] transition-colors hover:bg-[#F4F4F5] hover:text-[#52525B]"
          aria-label={`Remove ${ticker}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function StockPeerPickerModal({
  onClose,
  onPick,
  excludeTickers,
}: {
  onClose: () => void;
  onPick: (item: SearchAssetItem) => void;
  excludeTickers: Set<string>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SearchAssetItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setItems([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&scope=stocks`, { cache: "no-store" });
        const json = (await res.json()) as { items?: SearchAssetItem[] };
        if (cancelled) return;
        const all = Array.isArray(json.items) ? json.items : [];
        setItems(all.filter((x) => x.type === "stock" && !excludeTickers.has(x.symbol.toUpperCase())));
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query, excludeTickers]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[10vh]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="mx-4 w-full max-w-[560px] overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Add peer company"
      >
        <div className="flex items-center gap-3 border-b border-[#E4E4E7] px-5 py-3.5">
          <Search className="h-5 w-5 shrink-0 text-[#71717A]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search companies…"
            className="flex-1 bg-transparent text-[15px] leading-6 text-[#09090B] outline-none placeholder:text-[#A1A1AA]"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#E4E4E7] bg-[#F4F4F5] px-2 py-1 text-[12px] font-medium text-[#71717A] transition-colors hover:bg-[#E4E4E7]"
          >
            ESC
          </button>
        </div>

        <div className="max-h-[420px] overflow-y-auto py-2">
          {loading ? (
            <div className="px-5 py-10 text-center text-[14px] text-[#71717A]">Searching…</div>
          ) : items.length === 0 && query.trim().length > 0 ? (
            <div className="px-5 py-10 text-center text-[14px] text-[#71717A]">No companies found</div>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-[#F4F4F5]"
                onClick={() => onPick(item)}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center">
                  <CompanyLogo name={item.name} logoUrl={(item.logoUrl ?? "").trim()} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold leading-5 text-[#09090B]">{item.name}</div>
                  <div className="truncate text-[12px] leading-4 text-[#71717A]">{item.symbol}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function StockPeersTab({ ticker }: { ticker: string }) {
  const main = ticker.trim().toUpperCase();
  const [tickers, setTickers] = useState<string[]>([main]);
  const [rows, setRows] = useState<CompareRow[] | null>(null);
  const [loadingPeers, setLoadingPeers] = useState(true);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadDefault() {
      setLoadingPeers(true);
      setError(null);
      try {
        const res = await fetch(`/api/stocks/${encodeURIComponent(main)}/peers`, { cache: "no-store" });
        const json = (await res.json()) as { peers?: string[] };
        const peers = Array.isArray(json.peers) ? json.peers : [];
        if (cancelled) return;
        const next = [main, ...peers.map((p) => p.trim().toUpperCase()).filter(Boolean)].slice(0, 6);
        setTickers(next);
      } catch {
        if (!cancelled) setTickers([main]);
      } finally {
        if (!cancelled) setLoadingPeers(false);
      }
    }
    void loadDefault();
    return () => {
      cancelled = true;
    };
  }, [main]);

  useEffect(() => {
    let cancelled = false;
    async function loadCompare() {
      setLoadingCompare(true);
      setError(null);
      setRows(null);
      try {
        const res = await fetch("/api/stocks/peers/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tickers }),
        });
        if (!res.ok) {
          if (!cancelled) {
            setRows([]);
            setError("Failed to load peers.");
          }
          return;
        }
        const json = (await res.json()) as { rows?: CompareRow[] };
        if (cancelled) return;
        setRows(Array.isArray(json.rows) ? json.rows : []);
      } catch {
        if (!cancelled) {
          setRows([]);
          setError("Failed to load peers.");
        }
      } finally {
        if (!cancelled) setLoadingCompare(false);
      }
    }
    void loadCompare();
    return () => {
      cancelled = true;
    };
  }, [tickers]);

  const rowsByTicker = useMemo(() => {
    const m = new Map<string, CompareRow>();
    for (const r of rows ?? []) m.set(r.ticker.toUpperCase(), r);
    return m;
  }, [rows]);

  const exclude = useMemo(() => new Set(tickers.map((t) => t.toUpperCase())), [tickers]);

  const removePeer = (sym: string) => {
    const s = sym.toUpperCase();
    if (s === main) return;
    setTickers((prev) => prev.filter((x) => x.toUpperCase() !== s));
  };

  const addPeer = (sym: string) => {
    const s = sym.trim().toUpperCase();
    if (!s || exclude.has(s)) return;
    setTickers((prev) => [...prev, s].slice(0, 12));
  };

  const tableRows = useMemo(() => {
    return tickers.map((t) => {
      const r = rowsByTicker.get(t.toUpperCase()) ?? null;
      const meta = getStockDetailMetaFromTicker(t);
      const name = r?.fullName?.trim() ? r.fullName : meta.name;
      return {
        ticker: t,
        name,
        logoUrl: r?.logoUrl ?? null,
        revGrowth: r?.revGrowth ?? "—",
        grossProfit: r?.grossProfit ?? "—",
        operIncome: r?.operIncome ?? "—",
        netIncome: r?.netIncome ?? "—",
        eps: r?.eps ?? "—",
        epsGrowth: r?.epsGrowth ?? "—",
        revenue: r?.revenue ?? "—",
      };
    });
  }, [tickers, rowsByTicker]);

  return (
    <div className="space-y-4 pt-1">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-[15px] font-semibold tracking-tight text-[#09090B]">Peers</h2>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {tickers.map((t) => {
          const r = rowsByTicker.get(t.toUpperCase()) ?? null;
          const meta = getStockDetailMetaFromTicker(t);
          const name = r?.fullName?.trim() ? r.fullName : meta.name;
          return (
            <PeerChip
              key={t}
              ticker={t}
              name={name}
              logoUrl={r?.logoUrl ?? meta.logoUrl ?? null}
              removable={t.toUpperCase() !== main}
              onRemove={t.toUpperCase() !== main ? () => removePeer(t) : undefined}
            />
          );
        })}
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="inline-flex items-center rounded-full border border-dashed border-[#D4D4D8] bg-white px-2.5 py-1 text-[12px] font-medium text-[#71717A] transition-colors hover:border-[#C4C4C8] hover:bg-[#FAFAFA] hover:text-[#09090B]"
        >
          + Company
        </button>
      </div>

      {pickerOpen ? (
        <StockPeerPickerModal
          onClose={() => setPickerOpen(false)}
          excludeTickers={exclude}
          onPick={(item) => {
            addPeer(item.symbol);
            setPickerOpen(false);
          }}
        />
      ) : null}

      {loadingPeers || loadingCompare ? (
        <div className="h-[120px] rounded-xl bg-[#F4F4F5] animate-pulse" aria-hidden />
      ) : error ? (
        <div className="rounded-[12px] border border-[#E4E4E7] bg-white px-4 py-4 text-sm text-[#71717A]">
          {error}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse">
            <thead>
              <tr className="border-t border-b border-[#E4E4E7] bg-white">
                <th className="px-4 py-3 text-left text-[14px] font-semibold leading-5 text-[#71717A]">Company</th>
                {[
                  "Rev Growth",
                  "Gross Profit",
                  "Oper Income",
                  "Net Income",
                  "EPS",
                  "EPS Growth",
                  "Revenue",
                ].map((h) => (
                  <th key={h} className="px-4 py-3 text-right text-[14px] font-semibold leading-5 text-[#71717A]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r) => (
                <tr key={r.ticker} className="border-b border-[#E4E4E7] last:border-0 transition-colors duration-75 hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <CompanyLogo name={r.name} logoUrl={(r.logoUrl ?? "").trim()} />
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-semibold leading-5 text-[#09090B]">{r.name}</div>
                        <div className="text-[12px] leading-4 text-[#71717A]">{r.ticker}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-[14px] leading-5 tabular-nums text-[#09090B]">{r.revGrowth}</td>
                  <td className="px-4 py-3 text-right text-[14px] leading-5 tabular-nums text-[#09090B]">{r.grossProfit}</td>
                  <td className="px-4 py-3 text-right text-[14px] leading-5 tabular-nums text-[#09090B]">{r.operIncome}</td>
                  <td className="px-4 py-3 text-right text-[14px] leading-5 tabular-nums text-[#09090B]">{r.netIncome}</td>
                  <td className="px-4 py-3 text-right text-[14px] leading-5 tabular-nums text-[#09090B]">{r.eps}</td>
                  <td className="px-4 py-3 text-right text-[14px] leading-5 tabular-nums text-[#09090B]">{r.epsGrowth}</td>
                  <td className="px-4 py-3 text-right text-[14px] leading-5 tabular-nums text-[#09090B]">{r.revenue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

