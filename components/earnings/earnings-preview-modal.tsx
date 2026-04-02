"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";

import { CompanyLogo } from "@/components/screener/company-logo";
import type { EarningsCalendarItem } from "@/lib/market/earnings-calendar-types";

function formatYmdEnUS(ymd: string): string {
  const parts = ymd.split("-").map((x) => Number(x));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return ymd;
  const [y, m, d] = parts;
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

type PreviewApi = {
  ticker: string;
  companyName: string;
  logoUrl: string;
  earningsDateDisplay: string | null;
  estRevenueDisplay: string | null;
  estEpsDisplay: string | null;
};

function Tile({ label, value, loading }: { label: string; value: string | null; loading: boolean }) {
  return (
    <div className="rounded-xl border border-[#E4E4E7] bg-white px-3 py-3 shadow-[0_1px_2px_0_rgba(10,10,10,0.04)]">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[#A1A1AA]">{label}</p>
      <p className="mt-1.5 text-[15px] font-semibold tabular-nums text-[#09090B]">
        {loading ? <span className="text-[#D4D4D8]">…</span> : value ?? "—"}
      </p>
    </div>
  );
}

export function EarningsPreviewModal({
  item,
  onClose,
}: {
  item: EarningsCalendarItem | null;
  onClose: () => void;
}) {
  const [preview, setPreview] = useState<PreviewApi | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    if (!item) return;
    let cancelled = false;

    const q = new URLSearchParams({
      ticker: item.ticker,
      reportDate: item.reportDate,
      companyName: item.companyName,
      logoUrl: item.logoUrl,
    });

    void Promise.resolve()
      .then(() => {
        if (cancelled) return null;
        setLoading(true);
        setFetchError(false);
        setPreview(null);
        return fetch(`/api/earnings/preview?${q.toString()}`);
      })
      .then((r) => {
        if (r === null || cancelled) return null;
        if (!r.ok) throw new Error("bad status");
        return r.json() as Promise<PreviewApi>;
      })
      .then((data) => {
        if (data == null || cancelled) return;
        setPreview(data);
      })
      .catch(() => {
        if (!cancelled) setFetchError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [item]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!item) return;
    document.addEventListener("keydown", onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [item, onKeyDown]);

  if (!item) return null;

  const companyName = preview?.companyName ?? item.companyName;
  const logoUrl = preview?.logoUrl ?? item.logoUrl;
  const dateTile = preview?.earningsDateDisplay ?? formatYmdEnUS(item.reportDate);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="earnings-preview-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close preview"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-[440px] rounded-2xl border border-[#E4E4E7] bg-white p-5 shadow-lg">
        <div className="flex items-start gap-3">
          <CompanyLogo name={companyName || item.ticker} logoUrl={logoUrl} symbol={item.ticker} />
          <div className="min-w-0 flex-1">
            <p id="earnings-preview-title" className="text-[18px] font-semibold leading-6 text-[#09090B]">
              {item.ticker}
            </p>
            <p className="mt-0.5 text-[13px] leading-5 text-[#71717A]">{companyName}</p>
            {fetchError ? (
              <p className="mt-2 text-[12px] text-[#A1A1AA]">Estimates unavailable. Dates may still apply.</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#71717A] transition-colors hover:bg-[#F4F4F5] hover:text-[#09090B]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Tile label="Earnings date" value={dateTile} loading={false} />
          <Tile label="Est. revenue" value={preview?.estRevenueDisplay ?? null} loading={loading} />
          <Tile label="Est. EPS" value={preview?.estEpsDisplay ?? null} loading={loading} />
        </div>
      </div>
    </div>
  );
}
