"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft } from "@/lib/icons";

import { AssetPageHeaderActions } from "@/components/asset/asset-page-header-actions";
import { useMobileAssetTopbarSubtitle } from "@/components/layout/mobile-asset-topbar-context";
import { topbarSquircleIconClass } from "@/components/design-system/topbar-control-classes";
import {
  parseMobileAssetTopbarRoute,
} from "@/lib/layout/mobile-asset-topbar-route";
import { cryptoWatchlistKey } from "@/lib/watchlist/constants";

function MobileAssetTopbarTitle({
  line1,
  line2,
  line2Exchange,
  line2CountryFlag,
  line2Loading,
}: {
  line1: string;
  line2: string | null;
  line2Exchange?: string | null;
  line2CountryFlag?: string | null;
  line2Loading?: boolean;
}) {
  const hasStructuredLine2 = Boolean(line2Exchange?.trim() || line2CountryFlag);
  const hasPlainLine2 = Boolean(line2?.trim());

  return (
    <div className="min-w-0 flex-1 overflow-hidden px-1">
      <p className="truncate text-[14px] font-semibold leading-5 text-[#09090B]">{line1}</p>
      {line2Loading ? (
        <div className="mt-0.5 h-3.5 w-[5.5rem] max-w-full animate-pulse rounded bg-[#E4E4E7]" aria-hidden />
      ) : hasStructuredLine2 ? (
        <p className="mt-0.5 truncate text-[11px] leading-4 text-[#71717A]">
          {line2Exchange?.trim() ? <span>{line2Exchange.trim()}</span> : null}
          {line2Exchange?.trim() && line2CountryFlag ? (
            <span className="text-[#E4E4E7]" aria-hidden>
              {" "}
              ·{" "}
            </span>
          ) : null}
          {line2CountryFlag ? (
            <span className="inline-block align-[-1px] text-[12px] leading-none" aria-hidden>
              {line2CountryFlag}
            </span>
          ) : null}
        </p>
      ) : hasPlainLine2 ? (
        <p className="mt-0.5 truncate text-[11px] leading-4 text-[#71717A]">{line2}</p>
      ) : null}
    </div>
  );
}

export function MobileAssetTopbarChrome() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const route = parseMobileAssetTopbarRoute(pathname);
  const subtitle = useMobileAssetTopbarSubtitle();

  const handleBack = useCallback(() => {
    if (!route) return;
    const fallback = route.backHref;
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallback);
  }, [route, router]);

  if (!route) return null;

  const fallbackLine1 =
    route.kind === "stock" ? route.ticker : route.kind === "crypto" ? route.symbol : route.symbol;
  const line1 = subtitle?.line1?.trim() || fallbackLine1;
  const line2 = subtitle?.line2 ?? null;
  const line2Exchange = subtitle?.line2Exchange ?? null;
  const line2CountryFlag = subtitle?.line2CountryFlag ?? null;
  const line2Loading = subtitle?.line2Loading ?? false;

  return (
    <div className="flex w-full min-w-0 items-center gap-2">
      <button
        type="button"
        onClick={handleBack}
        aria-label="Go back"
        className={topbarSquircleIconClass}
      >
        <ChevronLeft className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
      </button>
      <MobileAssetTopbarTitle
        line1={line1}
        line2={line2}
        line2Exchange={line2Exchange}
        line2CountryFlag={line2CountryFlag}
        line2Loading={line2Loading}
      />
      {route.kind === "stock" ? (
        <AssetPageHeaderActions
          watchlistStorageKey={route.ticker}
          watchlistLabel={route.ticker}
          transactionSymbol={route.ticker}
          transactionName={route.ticker}
        />
      ) : route.kind === "crypto" ? (
        <AssetPageHeaderActions
          watchlistStorageKey={cryptoWatchlistKey(route.symbol)}
          watchlistLabel={route.symbol}
          transactionSymbol={route.symbol}
          transactionName={route.symbol}
        />
      ) : null}
    </div>
  );
}
