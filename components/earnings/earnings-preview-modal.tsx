"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-0.5 rounded-xl border border-[#E4E4E7] bg-white px-4 py-3 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]">
      <p className="text-[14px] font-semibold leading-5 text-[#71717A]">{label}</p>
      <p className="text-[18px] font-semibold leading-6 tabular-nums text-[#09090B]">
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

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
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
      <div
        className="relative z-10 flex w-full max-w-[580px] flex-col overflow-hidden rounded-xl border border-[#E4E4E7] bg-white shadow-[0px_10px_16px_-3px_rgba(10,10,10,0.1),0px_4px_6px_0px_rgba(10,10,10,0.04)]"
      >
        <div className="flex items-center gap-3 border-b border-[#E4E4E7] px-5 py-4">
          <CompanyLogo
            name={companyName || item.ticker}
            logoUrl={logoUrl}
            symbol={item.ticker}
            size="lg"
          />
          <p
            id="earnings-preview-title"
            className="flex min-w-0 flex-1 items-center gap-1.5 leading-none"
          >
            <span className="shrink-0 text-[18px] font-semibold leading-7 text-[#09090B]">{item.ticker}</span>
            <span className="min-w-0 truncate text-[14px] leading-5 text-[#71717A]">{companyName}</span>
          </p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[#71717A] transition-colors hover:bg-[#F4F4F5] hover:text-[#09090B]"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-5">
          {fetchError ? (
            <p className="text-[12px] leading-4 text-[#A1A1AA]">Estimates unavailable. Dates may still apply.</p>
          ) : null}
          <div className="flex flex-col gap-4 sm:flex-row">
            <Tile label="Earnings date" value={dateTile} loading={false} />
            <Tile label="Est. Revenue" value={preview?.estRevenueDisplay ?? null} loading={loading} />
            <Tile label="Est. EPS" value={preview?.estEpsDisplay ?? null} loading={loading} />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
