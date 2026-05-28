"use client";

import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { CompanyPicker } from "@/components/charting/company-picker";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import { useSpringTriplet } from "@/components/chart/use-spring-numbers";
import { portfolioHoldingAssetHref } from "@/lib/crypto/crypto-picker-universe";
import { mergeLogoMemory, readLogoMemory } from "@/lib/logos/logo-memory";
import { WatchlistStarButton } from "@/components/watchlist/watchlist-star-button";
import { SCREENER_CRYPTO_HREF } from "@/lib/screener/screener-market-url";
import { eodhdCryptoSpotTickerDisplay } from "@/lib/crypto/eodhd-crypto-ticker-display";
import { cryptoWatchlistKey } from "@/lib/watchlist/constants";

function formatCryptoUsd(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  const max = value < 1 ? 6 : value < 100 ? 4 : 2;
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: max, minimumFractionDigits: 2 })}`;
}

function formatCryptoChangeAbs(value: number | null, refPrice: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  const max = refPrice != null && refPrice < 1 ? 6 : refPrice != null && refPrice < 100 ? 4 : 2;
  return value.toLocaleString("en-US", { maximumFractionDigits: max, minimumFractionDigits: 2 });
}

type Props = {
  symbol: string;
  displayName: string;
  logoUrl: string | null;
  logoLetter: string;
  /** Period badge next to change (`Today` on overview = 1D session; holdings tab uses chart range). */
  periodLabel: string;
  periodLabelOverride?: string | null;
  /** Badge for period move when a range selection is active (e.g. `1Y`). */
  chartRangeLabel?: string;
  price: number | null;
  changePct: number | null;
  changeAbs: number | null;
  selectionChangeAbs?: number | null;
  selectionChangePct?: number | null;
  chartLoading: boolean;
  chartEmpty?: boolean;
  priceTimestampLabel?: string | null;
  chartHovering?: boolean;
  headerLoading: boolean;
};

export function CryptoHeader({
  symbol,
  displayName,
  logoUrl,
  logoLetter,
  periodLabel,
  periodLabelOverride = null,
  chartRangeLabel,
  price,
  changePct,
  changeAbs,
  selectionChangeAbs = null,
  selectionChangePct = null,
  chartLoading,
  chartEmpty = false,
  priceTimestampLabel = null,
  chartHovering = false,
  headerLoading,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openNewTransactionWithPreset } = usePortfolioWorkspace();
  const sym = symbol.trim().toUpperCase();
  const pairLabel = eodhdCryptoSpotTickerDisplay(sym);
  const serverLogo = logoUrl?.trim() ?? "";
  const memLogo = readLogoMemory(sym)?.trim() ?? "";
  const logoFailureKey = `${sym}|${serverLogo}`;
  const [imgFailedForKey, setImgFailedForKey] = useState<string | null>(null);
  const imgFailed = imgFailedForKey === logoFailureKey;
  const logoSrc = imgFailed ? "" : serverLogo || memLogo;

  useEffect(() => {
    if (serverLogo) mergeLogoMemory(sym, serverLogo);
  }, [sym, serverLogo]);

  const anim = useSpringTriplet(
    { price, abs: changeAbs, pct: changePct },
    { stiffness: 520, damping: 38, epsilon: 1e-4 },
  );

  const hasChange = changePct != null && changeAbs != null && Number.isFinite(changePct) && Number.isFinite(changeAbs);
  const isPositive = hasChange ? changeAbs! >= 0 : true;
  const hasSelectionSecondary =
    selectionChangeAbs != null &&
    selectionChangePct != null &&
    Number.isFinite(selectionChangeAbs) &&
    Number.isFinite(selectionChangePct);
  const isSelPositive = hasSelectionSecondary ? selectionChangeAbs! >= 0 : true;
  const wlKey = cryptoWatchlistKey(sym);

  return (
    <div className="space-y-3 max-md:px-3 md:px-0">
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-[14px] text-[#71717A] sm:flex-nowrap sm:overflow-hidden">
        <Link href={SCREENER_CRYPTO_HREF} className="shrink-0 transition-colors hover:text-[#09090B]">
          Crypto
        </Link>
        <span className="shrink-0 select-none" aria-hidden>
          /
        </span>
        <div className="shrink-0">
          <CompanyPicker
            includeCrypto
            alwaysAllowOpen
            menuAlign="trailing"
            maxExtraCompanies={1}
            excludeSymbols={[sym]}
            onPick={({ symbol: nextSym }) => {
              const href = portfolioHoldingAssetHref(nextSym);
              if (!href) return;
              const qs =
                typeof window !== "undefined"
                  ? window.location.search.replace(/^\?/, "")
                  : (searchParams?.toString() ?? "");
              router.push(`${href}${qs ? `?${qs}` : ""}`);
            }}
          >
            {({ open, setOpen }) => (
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                aria-haspopup="listbox"
                aria-label={`${pairLabel}, search for another asset`}
                className="inline-flex h-6 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-[#E4E4E7] bg-white px-2 text-[12px] font-medium leading-4 text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-colors hover:bg-[#FAFAFA]"
                title={pairLabel}
              >
                <Search className="h-3.5 w-3.5 shrink-0 text-[#71717A]" strokeWidth={2} aria-hidden />
                <span className="truncate">{pairLabel}</span>
              </button>
            )}
          </CompanyPicker>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          {headerLoading ? (
            <div className="h-12 w-12 shrink-0 animate-pulse rounded-xl border border-[#E4E4E7] bg-[#F4F4F5]" aria-hidden />
          ) : logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote logo
            <img
              src={logoSrc}
              alt=""
              width={48}
              height={48}
              className="h-12 w-12 shrink-0 rounded-xl border border-neutral-200 bg-white object-contain shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]"
              onError={() => {
                setImgFailedForKey(logoFailureKey);
                mergeLogoMemory(sym, null);
              }}
            />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#E4E4E7] bg-[#F4F4F5] text-[18px] font-bold text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]">
              {logoLetter.slice(0, 1)}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-[20px] font-semibold leading-7 text-[#09090B] [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden break-words">
              {displayName}
            </h1>
            {headerLoading ? (
              <div className="mt-1 h-4 max-w-[min(100%,28rem)] rounded bg-neutral-200/80 animate-pulse" aria-hidden />
            ) : (
              <p className="mt-1 text-[13px] leading-5 text-[#71717A]">
                <span className="whitespace-normal break-words">{pairLabel}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="group shrink-0">
            <WatchlistStarButton variant="detail" storageKey={wlKey} label={sym} />
          </div>
          <button
            type="button"
            onClick={() =>
              openNewTransactionWithPreset({
                symbol: sym,
                name: displayName.trim() || sym,
              })
            }
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#2563EB] text-[13px] font-semibold text-white shadow-[0px_1px_2px_0px_rgba(37,99,235,0.25)] transition-colors hover:bg-[#1D4ED8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/30 focus-visible:ring-offset-2 sm:w-auto sm:gap-1.5 sm:px-3.5"
            aria-label="Add Trade"
          >
            <Plus className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
            <span className="hidden sm:inline">Add Trade</span>
          </button>
        </div>
      </div>

      <div>
        <div
          className={`flex flex-wrap items-baseline gap-2 transition-[transform,opacity] duration-200 ease-out ${
            chartHovering ? "translate-y-px" : ""
          }`}
        >
          <span
            suppressHydrationWarning
            className={`text-[28px] font-semibold leading-9 tabular-nums text-[#09090B] transition-[transform] duration-200 ease-out ${
              chartHovering ? "scale-[1.01]" : "scale-100"
            }`}
          >
            {chartLoading || anim.price == null ? "—" : formatCryptoUsd(anim.price)}
          </span>
          {hasSelectionSecondary ? (
            <>
              <span
                suppressHydrationWarning
                className={`text-[15px] font-medium tabular-nums transition-colors duration-200 ease-out ${
                  hasChange ? (isPositive ? "text-[#16A34A]" : "text-[#DC2626]") : "text-[#71717A]"
                }`}
              >
                {chartLoading || !hasChange || anim.abs == null || anim.pct == null
                  ? "—"
                  : `${isPositive ? "+" : ""}${formatCryptoChangeAbs(anim.abs, anim.price)} (${isPositive ? "+" : ""}${anim.pct.toFixed(2)}%)`}
              </span>
              {chartRangeLabel ? (
                <span className="text-[13px] text-[#71717A]">{chartRangeLabel}</span>
              ) : null}
              <span className="text-[13px] text-[#71717A]" aria-hidden>
                ·
              </span>
              <span
                suppressHydrationWarning
                className={`text-[15px] font-medium tabular-nums transition-colors duration-200 ease-out ${
                  isSelPositive ? "text-[#16A34A]" : "text-[#DC2626]"
                }`}
              >
                {`${isSelPositive ? "+" : ""}${formatCryptoChangeAbs(selectionChangeAbs!, anim.price)} (${isSelPositive ? "+" : ""}${selectionChangePct!.toFixed(2)}%)`}
              </span>
              <span className="text-[13px] text-[#71717A]">Selected range</span>
            </>
          ) : (
            <>
              <span
                suppressHydrationWarning
                className={`text-[15px] font-medium tabular-nums transition-colors duration-200 ease-out ${
                  hasChange ? (isPositive ? "text-[#16A34A]" : "text-[#DC2626]") : "text-[#71717A]"
                }`}
              >
                {chartLoading || !hasChange || anim.abs == null || anim.pct == null
                  ? "—"
                  : `${isPositive ? "+" : ""}${formatCryptoChangeAbs(anim.abs, anim.price)} (${isPositive ? "+" : ""}${anim.pct.toFixed(2)}%)`}
              </span>
              <span className="text-[13px] text-[#71717A]">{periodLabelOverride ?? periodLabel}</span>
            </>
          )}
        </div>
        {chartLoading ? (
          <div className="mt-0.5 text-[12px] text-[#71717A]">Loading…</div>
        ) : chartEmpty ? null : priceTimestampLabel ? (
          <div suppressHydrationWarning className="mt-0.5 text-[12px] leading-4 text-[#71717A]">
            {priceTimestampLabel}
          </div>
        ) : null}
      </div>
    </div>
  );
}
