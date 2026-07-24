"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BTC_LINE_COLOR,
  FearGreedHistoryLineChart,
  FG_BADGE_SWATCH,
  type FearGreedHistoryAxisRange,
} from "@/components/screener/fear-greed-history-line-chart";
import type { MacroRangeId } from "@/components/macro/macro-range";
import type { CryptoFearGreedHistoryPoint } from "@/lib/market/alternative-fear-greed";
import { cn } from "@/lib/utils";

const MACRO_TO_AXIS: Partial<Record<MacroRangeId, FearGreedHistoryAxisRange>> = {
  "5y": "5Y",
  "10y": "10Y",
  "20y": "20Y",
  all: "ALL",
};

function rangeStartSec(lastTs: number, rangeId: MacroRangeId): number | null {
  if (rangeId === "all") return null;
  if (rangeId === "5y" || rangeId === "10y" || rangeId === "20y") {
    const years = rangeId === "5y" ? 5 : rangeId === "10y" ? 10 : 20;
    return lastTs - years * 365 * 24 * 60 * 60;
  }
  // Short daily ranges are unused on Fear & Greed; fall back to full history.
  return null;
}

export function MacroFearGreedChart({
  rangeId,
  height,
}: {
  rangeId: MacroRangeId;
  height: number;
}) {
  const [loading, setLoading] = useState(true);
  const [allPoints, setAllPoints] = useState<CryptoFearGreedHistoryPoint[]>([]);
  const [btcAllPoints, setBtcAllPoints] = useState<{ time: number; value: number }[]>([]);
  const [showIndex, setShowIndex] = useState(true);
  const [showBtc, setShowBtc] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch("/api/crypto/fear-greed?limit=0", { credentials: "include" }).then((r) =>
        r.ok ? r.json() : Promise.reject(new Error("Fear & Greed request failed")),
      ),
      fetch("/api/crypto/BTC/chart?range=ALL&series=price", { credentials: "include" }).then((r) =>
        r.ok ? r.json() : Promise.reject(new Error("BTC chart request failed")),
      ),
    ])
      .then(
        ([fgData, btcData]: [
          { points?: CryptoFearGreedHistoryPoint[] },
          { points?: { time: number; value: number }[] },
        ]) => {
          if (cancelled) return;
          setAllPoints(Array.isArray(fgData.points) ? fgData.points : []);
          const raw = Array.isArray(btcData.points) ? btcData.points : [];
          setBtcAllPoints(
            raw
              .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.value))
              .map((p) => ({ time: p.time, value: p.value }))
              .sort((a, b) => a.time - b.time),
          );
        },
      )
      .catch(() => {
        if (!cancelled) {
          setAllPoints([]);
          setBtcAllPoints([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const points = useMemo(() => {
    if (!allPoints.length) return [];
    const start = rangeStartSec(allPoints[allPoints.length - 1]!.timestamp, rangeId);
    if (start == null) return allPoints;
    return allPoints.filter((p) => p.timestamp >= start);
  }, [allPoints, rangeId]);

  const btcPoints = useMemo(() => {
    if (!btcAllPoints.length) return [];
    if (!points.length) {
      const start = rangeStartSec(btcAllPoints[btcAllPoints.length - 1]!.time, rangeId);
      if (start == null) return btcAllPoints;
      return btcAllPoints.filter((p) => p.time >= start);
    }
    const minTs = points[0]!.timestamp;
    const maxTs = points[points.length - 1]!.timestamp;
    return btcAllPoints.filter((p) => p.time >= minTs && p.time <= maxTs);
  }, [btcAllPoints, points, rangeId]);

  const toggleIndex = useCallback(() => {
    setShowIndex((cur) => {
      if (cur && !showBtc) return cur;
      return !cur;
    });
  }, [showBtc]);

  const toggleBtc = useCallback(() => {
    setShowBtc((cur) => {
      if (cur && !showIndex) return cur;
      return !cur;
    });
  }, [showIndex]);

  const axisRange = MACRO_TO_AXIS[rangeId] ?? "ALL";

  return (
    <div className="min-w-0 w-full">
      <FearGreedHistoryLineChart
        key={rangeId}
        points={points}
        btcPoints={btcPoints}
        range={axisRange}
        loading={loading}
        showIndex={showIndex}
        showBtc={showBtc}
        height={height}
      />
      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
        <button
          type="button"
          onClick={toggleIndex}
          aria-pressed={showIndex}
          className={cn(
            "inline-flex h-6 max-w-full min-w-0 items-center gap-2 overflow-hidden rounded-[8px] border border-[#E4E4E7] bg-white px-3 py-0 text-[12px] font-medium leading-none text-[#0F0F0F] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)] transition-opacity",
            !showIndex && "opacity-40",
          )}
        >
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: FG_BADGE_SWATCH }}
            aria-hidden
          />
          <span className="min-w-0 truncate">Fear and Greed Index</span>
        </button>
        <button
          type="button"
          onClick={toggleBtc}
          aria-pressed={showBtc}
          className={cn(
            "inline-flex h-6 max-w-full min-w-0 items-center gap-2 overflow-hidden rounded-[8px] border border-[#E4E4E7] bg-white px-3 py-0 text-[12px] font-medium leading-none text-[#0F0F0F] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)] transition-opacity",
            !showBtc && "opacity-40",
          )}
        >
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: BTC_LINE_COLOR }}
            aria-hidden
          />
          <span className="min-w-0 truncate">Bitcoin Price</span>
        </button>
      </div>
    </div>
  );
}
