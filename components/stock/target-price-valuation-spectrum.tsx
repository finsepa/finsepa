"use client";

import { MOBILE_PANEL_CARD_CLASS, STOCK_OVERVIEW_SECTION_TITLE_CLASS } from "@/components/design-system/card-surface-styles";
import { formatUsdPrice } from "@/lib/market/key-stats-basic-format";
import { cn } from "@/lib/utils";

/** Soft tints for undervalued / about right / overvalued zones. */
const ZONE_UNDERVALUED = "#BBF7D0";
const ZONE_ABOUT_RIGHT = "#FDE68A";
const ZONE_OVERVALUED = "#FECACA";

/** Fixed spectrum bands: undervalued 60% | about right 20% | overvalued 20%. */
const ZONE_UNDERVALUED_WIDTH_PCT = 60;
const ZONE_ABOUT_RIGHT_WIDTH_PCT = 20;
const ZONE_OVERVALUED_EDGE_PCT = ZONE_UNDERVALUED_WIDTH_PCT + ZONE_ABOUT_RIGHT_WIDTH_PCT;

/**
 * Map a price onto the 60/20/20 spectrum.
 * 0.5×anchor → 0%, 0.8× → 60%, 1.2× → 80%, 1.5× → 100%.
 */
function priceToSpectrumPct(price: number, anchor: number): number {
  const lo = anchor * 0.5;
  const undervaluedAt = anchor * 0.8;
  const overvaluedAt = anchor * 1.2;
  const hi = anchor * 1.5;
  if (!(anchor > 0) || !Number.isFinite(price)) return 50;
  if (price <= lo) return 0;
  if (price >= hi) return 100;
  if (price <= undervaluedAt) {
    return ((price - lo) / (undervaluedAt - lo)) * ZONE_UNDERVALUED_WIDTH_PCT;
  }
  if (price <= overvaluedAt) {
    return (
      ZONE_UNDERVALUED_WIDTH_PCT +
      ((price - undervaluedAt) / (overvaluedAt - undervaluedAt)) * ZONE_ABOUT_RIGHT_WIDTH_PCT
    );
  }
  return (
    ZONE_OVERVALUED_EDGE_PCT + ((price - overvaluedAt) / (hi - overvaluedAt)) * (100 - ZONE_OVERVALUED_EDGE_PCT)
  );
}

/**
 * Soft green / amber / red valuation spectrum — current vs fair/target.
 */
export function TargetPriceValuationSpectrum({
  currentPrice,
  fairValue,
  fallbackTarget,
}: {
  currentPrice: number | null;
  fairValue: number | null;
  /** Analyst consensus when fair value is missing. */
  fallbackTarget: number | null;
}) {
  const fair = fairValue != null && Number.isFinite(fairValue) && fairValue > 0 ? fairValue : null;
  const target =
    fair ??
    (fallbackTarget != null && Number.isFinite(fallbackTarget) && fallbackTarget > 0 ? fallbackTarget : null);
  const current =
    currentPrice != null && Number.isFinite(currentPrice) && currentPrice > 0 ? currentPrice : null;

  if (target == null && current == null) {
    return (
      <div className={cn(MOBILE_PANEL_CARD_CLASS, "w-full min-w-0 p-3 sm:p-4")}>
        <p className={STOCK_OVERVIEW_SECTION_TITLE_CLASS}>Target price</p>
        <p className="mt-1 text-[28px] font-semibold tabular-nums leading-8 tracking-tight text-[#141414]">—</p>
      </div>
    );
  }

  const anchor = target ?? current!;
  const undervaluedPct = ZONE_UNDERVALUED_WIDTH_PCT;
  const overvaluedPct = ZONE_OVERVALUED_EDGE_PCT;
  const fairPct = priceToSpectrumPct(anchor, anchor);
  const currentPct = current != null ? priceToSpectrumPct(current, anchor) : null;

  const vsFairPct =
    current != null && target != null ? ((target - current) / target) * 100 : null;
  const valuationLabel =
    vsFairPct == null ? null
    : vsFairPct > 2 ? "Undervalued"
    : vsFairPct < -2 ? "Overvalued"
    : "About right";
  const valuationTone =
    valuationLabel === "Undervalued" ? "text-[#16A34A]"
    : valuationLabel === "Overvalued" ? "text-[#DC2626]"
    : "text-[#CA8A04]";

  const fairCaption = fair != null ? "Fair value" : "Target price";
  const leftMarkerPct = currentPct != null ? Math.min(currentPct, fairPct) : fairPct;
  const rightMarkerPct = currentPct != null ? Math.max(currentPct, fairPct) : fairPct;
  const midMarkerPct = (leftMarkerPct + rightMarkerPct) / 2;
  const spanMarkers = currentPct != null && Math.abs(currentPct - fairPct) > 1;
  const currentIsLeft = currentPct != null && currentPct <= fairPct;

  return (
    <div className={cn(MOBILE_PANEL_CARD_CLASS, "w-full min-w-0 overflow-hidden p-3 sm:p-4")}>
      <p className={STOCK_OVERVIEW_SECTION_TITLE_CLASS}>Target price</p>

      <div className="mt-3">
        <div className="relative">
          <div className="h-16" aria-hidden={vsFairPct == null} />

          <div className="relative">
            {vsFairPct != null && valuationLabel ? (
              <>
                <div
                  className="pointer-events-none absolute z-20 flex -translate-x-1/2 flex-col items-center"
                  style={{ left: `${midMarkerPct}%`, top: "-4.35rem" }}
                >
                  <span className={cn("text-[22px] font-semibold tabular-nums leading-7", valuationTone)}>
                    {Math.abs(vsFairPct).toFixed(1)}%
                  </span>
                  <span className={cn("text-[12px] font-medium leading-4", valuationTone)}>{valuationLabel}</span>
                </div>
                {spanMarkers ? (
                  <div
                    className="pointer-events-none absolute z-10"
                    style={{
                      left: `${leftMarkerPct}%`,
                      width: `${Math.max(0, rightMarkerPct - leftMarkerPct)}%`,
                      top: "-1.15rem",
                      borderTopWidth: 3,
                      borderTopStyle: "solid",
                      borderTopColor:
                        valuationLabel === "Undervalued"
                          ? "#16A34A"
                          : valuationLabel === "Overvalued"
                            ? "#DC2626"
                            : "#CA8A04",
                    }}
                    aria-hidden
                  >
                    <span
                      className="absolute left-0 top-0 w-px bg-[#A1A1AA]"
                      style={{ height: currentIsLeft ? "2.35rem" : "4.85rem" }}
                    />
                    <span
                      className="absolute right-0 top-0 w-px bg-[#A1A1AA]"
                      style={{ height: currentIsLeft ? "4.85rem" : "2.35rem" }}
                    />
                  </div>
                ) : null}
              </>
            ) : null}

            <div className="relative h-[6.75rem] w-full overflow-hidden rounded-2xl sm:h-32">
              <div
                className="absolute inset-y-0 left-0"
                style={{ width: `${undervaluedPct}%`, backgroundColor: ZONE_UNDERVALUED }}
                aria-hidden
              />
              <div
                className="absolute inset-y-0"
                style={{
                  left: `${undervaluedPct}%`,
                  width: `${Math.max(0, overvaluedPct - undervaluedPct)}%`,
                  backgroundColor: ZONE_ABOUT_RIGHT,
                }}
                aria-hidden
              />
              <div
                className="absolute inset-y-0 right-0"
                style={{ left: `${overvaluedPct}%`, backgroundColor: ZONE_OVERVALUED }}
                aria-hidden
              />

              <div className="relative z-[2] flex h-full flex-col justify-center gap-2 px-0 py-2 sm:gap-2.5 sm:py-2.5">
                {current != null && currentPct != null ? (
                  <div className="relative h-9 w-full sm:h-10">
                    <div
                      className="absolute inset-y-0 left-0 rounded-r-[10px]"
                      style={{
                        width: `${currentPct}%`,
                        backgroundImage:
                          "linear-gradient(to right, rgb(255 255 255 / 30%), #fff 70%, #fff)",
                      }}
                      aria-hidden
                    />
                    <div
                      className="absolute top-1/2 z-[1] flex h-9 min-w-[6.75rem] -translate-x-full -translate-y-1/2 flex-col items-end justify-center rounded-r-[10px] bg-white px-2.5 py-1 text-right sm:h-10"
                      style={{ left: `${currentPct}%` }}
                    >
                      <span className="text-[10px] font-medium leading-3 text-[#5C5D5F]">Current price</span>
                      <span className="text-[13px] font-semibold tabular-nums leading-4 text-[#141414] sm:text-[14px]">
                        {formatUsdPrice(current)}
                      </span>
                    </div>
                  </div>
                ) : null}

                <div className="relative h-9 w-full sm:h-10">
                  <div
                    className="absolute inset-y-0 left-0 rounded-r-[10px]"
                    style={{
                      width: `${fairPct}%`,
                      backgroundImage:
                        "linear-gradient(to right, rgb(255 255 255 / 30%), #fff 70%, #fff)",
                    }}
                    aria-hidden
                  />
                  <div
                    className="absolute top-1/2 z-[1] flex h-9 min-w-[6.75rem] -translate-x-full -translate-y-1/2 flex-col items-end justify-center rounded-r-[10px] bg-white px-2.5 py-1 text-right sm:h-10"
                    style={{ left: `${fairPct}%` }}
                  >
                    <span className="text-[10px] font-medium leading-3 text-[#5C5D5F]">{fairCaption}</span>
                    <span className="text-[13px] font-semibold tabular-nums leading-4 text-[#141414] sm:text-[14px]">
                      {formatUsdPrice(anchor)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative mt-2 h-4 w-full">
          <span
            className="absolute top-0 -translate-x-1/2 text-center text-[11px] font-medium leading-4 text-[#16A34A]"
            style={{ left: `${ZONE_UNDERVALUED_WIDTH_PCT / 2}%` }}
          >
            Undervalued
          </span>
          <span
            className="absolute top-0 -translate-x-1/2 text-center text-[11px] font-medium leading-4 text-[#CA8A04]"
            style={{ left: `${ZONE_UNDERVALUED_WIDTH_PCT + ZONE_ABOUT_RIGHT_WIDTH_PCT / 2}%` }}
          >
            About right
          </span>
          <span
            className="absolute top-0 -translate-x-1/2 text-center text-[11px] font-medium leading-4 text-[#DC2626]"
            style={{ left: `${ZONE_OVERVALUED_EDGE_PCT + (100 - ZONE_OVERVALUED_EDGE_PCT) / 2}%` }}
          >
            Overvalued
          </span>
        </div>
      </div>
    </div>
  );
}
