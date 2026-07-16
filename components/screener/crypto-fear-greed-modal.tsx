"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { TabSwitcher, type TabSwitcherOption } from "@/components/design-system";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import { AppModalCloseButton, AppModalShell } from "@/components/ui/app-modal-shell";
import type { CryptoFearGreedHistoryPoint } from "@/lib/market/alternative-fear-greed";
import { cn } from "@/lib/utils";
import {
  BTC_LINE_COLOR,
  FearGreedHistoryLineChart,
  FEAR_GREED_CHART_RANGES,
  FG_BADGE_SWATCH,
  type FearGreedChartRange,
} from "@/components/screener/fear-greed-history-line-chart";

const FEAR_GREED_RANGE_TAB_OPTIONS: TabSwitcherOption<FearGreedChartRange>[] =
  FEAR_GREED_CHART_RANGES.map((value) => ({ value, label: value }));

export function CryptoFearGreedModal({
  open,
  onClose,
  latestValue: _latestValue,
  latestLabel: _latestLabel,
}: {
  open: boolean;
  onClose: () => void;
  latestValue: number | null;
  latestLabel: string;
}) {
  const titleId = useId();
  const [range, setRange] = useState<FearGreedChartRange>("1Y");
  const [loading, setLoading] = useState(false);
  const [allPoints, setAllPoints] = useState<CryptoFearGreedHistoryPoint[]>([]);
  const [btcAllPoints, setBtcAllPoints] = useState<{ time: number; value: number }[]>([]);
  const [showIndex, setShowIndex] = useState(true);
  const [showBtc, setShowBtc] = useState(true);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onKeyDown]);

  useEffect(() => {
    if (!open) return;
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
      .then(([fgData, btcData]: [{ points?: CryptoFearGreedHistoryPoint[] }, { points?: { time: number; value: number }[] }]) => {
        if (cancelled) return;
        setAllPoints(Array.isArray(fgData.points) ? fgData.points : []);
        const raw = Array.isArray(btcData.points) ? btcData.points : [];
        setBtcAllPoints(
          raw
            .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.value))
            .map((p) => ({ time: p.time, value: p.value }))
            .sort((a, b) => a.time - b.time),
        );
      })
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
  }, [open]);

  const points = useMemo(() => {
    if (!allPoints.length) return [];
    if (range === "ALL") return allPoints;

    const lastTs = allPoints[allPoints.length - 1]!.timestamp;
    const lastDate = new Date(lastTs * 1000);
    const start = (() => {
      if (range === "1M") return lastTs - 30 * 24 * 60 * 60;
      if (range === "6M") return lastTs - 183 * 24 * 60 * 60;
      if (range === "YTD") return Math.floor(Date.UTC(lastDate.getUTCFullYear(), 0, 1) / 1000);
      if (range === "1Y") return lastTs - 365 * 24 * 60 * 60;
      if (range === "5Y") return lastTs - 5 * 365 * 24 * 60 * 60;
      return lastTs - 30 * 24 * 60 * 60;
    })();

    return allPoints.filter((p) => p.timestamp >= start);
  }, [allPoints, range]);

  const btcPoints = useMemo(() => {
    if (!btcAllPoints.length) return [];
    if (!points.length) {
      if (range === "ALL") return btcAllPoints;
      const lastTs = btcAllPoints[btcAllPoints.length - 1]!.time;
      const lastDate = new Date(lastTs * 1000);
      const start = (() => {
        if (range === "1M") return lastTs - 30 * 24 * 60 * 60;
        if (range === "6M") return lastTs - 183 * 24 * 60 * 60;
        if (range === "YTD") return Math.floor(Date.UTC(lastDate.getUTCFullYear(), 0, 1) / 1000);
        if (range === "1Y") return lastTs - 365 * 24 * 60 * 60;
        if (range === "5Y") return lastTs - 5 * 365 * 24 * 60 * 60;
        return lastTs - 30 * 24 * 60 * 60;
      })();
      return btcAllPoints.filter((p) => p.time >= start);
    }
    const minTs = points[0]!.timestamp;
    const maxTs = points[points.length - 1]!.timestamp;
    return btcAllPoints.filter((p) => p.time >= minTs && p.time <= maxTs);
  }, [btcAllPoints, points, range]);

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

  if (!open) return null;

  const seriesBadges = (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        onClick={toggleIndex}
        aria-pressed={showIndex}
        className={cn(
          "inline-flex h-6 max-w-full min-w-0 items-center gap-2 overflow-hidden rounded-[8px] border border-[#E4E4E7] bg-white px-3 py-0 text-[12px] font-medium leading-none text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)] transition-opacity",
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
          "inline-flex h-6 max-w-full min-w-0 items-center gap-2 overflow-hidden rounded-[8px] border border-[#E4E4E7] bg-white px-3 py-0 text-[12px] font-medium leading-none text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)] transition-opacity",
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
  );

  return (
    <AppModalOverlay open={open} onClose={onClose} zIndex={300}>
      <AppModalShell
        titleId={titleId}
        maxWidthClass="w-full max-w-[min(960px,calc(100vw-2rem))]"
        maxHeightClass="max-h-[min(92vh,900px)]"
        bodyScroll={false}
        header={
          <div className="flex w-full min-w-0 items-center gap-3">
            <h2 id={titleId} className="min-w-0 flex-1 truncate text-[18px] font-semibold leading-7 text-[#09090B]">
              Fear &amp; Greed Index
            </h2>
            <div className="flex shrink-0 items-center gap-3">
              <TabSwitcher
                size="sm"
                options={FEAR_GREED_RANGE_TAB_OPTIONS}
                value={range}
                onChange={setRange}
                aria-label="Date range"
              />
              <div className="h-6 w-px shrink-0 bg-[#E4E4E7]" aria-hidden />
              <AppModalCloseButton onClick={onClose} />
            </div>
          </div>
        }
        headerClassName="px-5 py-4"
        bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
        cardClassName="overflow-hidden border-0 shadow-none"
      >
        <div className="flex min-h-0 flex-1 flex-col px-5 pb-5 pt-2">
          <div className="min-h-0 w-full shrink-0">
            <FearGreedHistoryLineChart
              key={range}
              points={points}
              btcPoints={btcPoints}
              range={range}
              loading={loading}
              showIndex={showIndex}
              showBtc={showBtc}
            />
          </div>
          <div className="flex shrink-0 justify-center pt-1 pb-1">{seriesBadges}</div>
        </div>
      </AppModalShell>
    </AppModalOverlay>
  );
}
