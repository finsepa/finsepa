"use client";

import { memo, useEffect, useMemo, useState } from "react";

import { Spinner } from "@/components/ui/spinner";
import { MOBILE_INSET_CARD_CLASS, STOCK_OVERVIEW_SECTION_TITLE_CLASS } from "@/components/design-system/card-surface-styles";
import { stockKeyIndicatorsClientEnabled } from "@/lib/features/key-indicators";
import { ArrowCircleBrokenDownRight, ArrowCircleBrokenUpRight, CalendarDays } from "@/lib/icons";
import type {
  StockKeyIndicator,
  StockKeyIndicatorsResponse,
} from "@/lib/market/stock-key-indicators-types";
import { cn } from "@/lib/utils";

const KEY_INDICATORS_CARD_CLASS = cn("mb-5 p-4 max-md:mb-0", MOBILE_INSET_CARD_CLASS);

function formatAnalyzedAt(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(d);
}

function isProIndicator(indicator: StockKeyIndicator): boolean {
  if (indicator.id === "earnings_countdown") return true;
  return indicator.direction === "up";
}

function splitIndicators(indicators: StockKeyIndicator[]): { pros: StockKeyIndicator[]; cons: StockKeyIndicator[] } {
  const pros: StockKeyIndicator[] = [];
  const cons: StockKeyIndicator[] = [];
  for (const indicator of indicators) {
    if (isProIndicator(indicator)) pros.push(indicator);
    else cons.push(indicator);
  }
  return { pros, cons };
}

function IndicatorIcon({ indicator }: { indicator: StockKeyIndicator }) {
  if (indicator.id === "earnings_countdown") {
    return (
      <CalendarDays className="size-4 shrink-0 text-[#16A34A]" strokeWidth={2} aria-hidden />
    );
  }

  if (indicator.direction === "up") {
    return (
      <ArrowCircleBrokenUpRight className="size-4 shrink-0 text-[#16A34A]" strokeWidth={2} aria-hidden />
    );
  }

  return (
    <ArrowCircleBrokenDownRight className="size-4 shrink-0 text-[#DC2626]" strokeWidth={2} aria-hidden />
  );
}

function IndicatorLine({ indicator }: { indicator: StockKeyIndicator }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5">
        <IndicatorIcon indicator={indicator} />
      </span>
      <p className="min-w-0 pt-0.5 text-[14px] leading-5 text-[#09090B]">
        {indicator.parts.map((part, i) =>
          part.kind === "emphasis" ? (
            <span key={i} className="font-semibold text-[#09090B]">
              {part.value}
            </span>
          ) : (
            <span key={i}>{part.value}</span>
          ),
        )}
      </p>
    </li>
  );
}

function IndicatorColumn({ items }: { items: StockKeyIndicator[] }) {
  if (!items.length) return <div className="hidden md:block" aria-hidden />;
  return (
    <ul className="space-y-3">
      {items.map((indicator) => (
        <IndicatorLine key={indicator.id} indicator={indicator} />
      ))}
    </ul>
  );
}

function KeyIndicatorsInner({ ticker }: { ticker: string }) {
  const enabled = stockKeyIndicatorsClientEnabled();
  const [loading, setLoading] = useState(enabled);
  const [payload, setPayload] = useState<StockKeyIndicatorsResponse | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/stocks/${encodeURIComponent(ticker)}/key-indicators`, {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok) {
          if (!cancelled) setPayload(null);
          return;
        }
        const json = (await res.json()) as StockKeyIndicatorsResponse;
        if (!cancelled) setPayload(json);
      } catch {
        if (!cancelled) setPayload(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [enabled, ticker]);

  const indicators = payload?.indicators ?? [];
  const { pros, cons } = useMemo(() => splitIndicators(indicators), [indicators]);

  if (!enabled) return null;

  if (loading) {
    return (
      <div
        className={cn(KEY_INDICATORS_CARD_CLASS, "flex min-h-[120px] items-center justify-center")}
        aria-busy="true"
        aria-label="Loading key indicators"
      >
        <Spinner className="size-5 text-[#71717A]" />
      </div>
    );
  }

  if (indicators.length < 2) return null;

  const analyzedLabel = formatAnalyzedAt(payload?.computedAt ?? null);
  const singleColumn = pros.length === 0 || cons.length === 0;

  return (
    <section className={KEY_INDICATORS_CARD_CLASS} aria-label="Key indicators">
      <h3 className={cn("mb-3", STOCK_OVERVIEW_SECTION_TITLE_CLASS)}>Key Indicators</h3>

      <div className={cn("grid gap-4", singleColumn ? "grid-cols-1" : "md:grid-cols-2")}>
        {pros.length > 0 ? <IndicatorColumn items={pros} /> : null}
        {cons.length > 0 ? <IndicatorColumn items={cons} /> : null}
      </div>

      {analyzedLabel ? (
        <p className="mt-4 text-[12px] leading-4 text-[#71717A]">Metrics analyzed at {analyzedLabel}</p>
      ) : null}
    </section>
  );
}

export const KeyIndicators = memo(KeyIndicatorsInner);
