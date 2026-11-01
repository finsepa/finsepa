"use client";

import Link from "next/link";

import { AssetBreadcrumbBar } from "@/components/stock/asset-breadcrumb-bar";
import { eodhdCryptoSpotTickerDisplay } from "@/lib/crypto/eodhd-crypto-ticker-display";
import { SCREENER_CRYPTO_HREF } from "@/lib/screener/screener-market-url";

type Props = {
  symbol: string;
};

export function CryptoBreadcrumbs({ symbol }: Props) {
  const sym = symbol.trim().toUpperCase();
  const pairLabel = eodhdCryptoSpotTickerDisplay(sym);

  const breadcrumbLinkClass =
    "min-w-0 truncate transition-colors hover:text-fg hover:underline";
  const breadcrumbSep = (
    <span className="shrink-0 select-none" aria-hidden>
      /
    </span>
  );

  return (
    <AssetBreadcrumbBar>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:flex-nowrap">
        <Link href={SCREENER_CRYPTO_HREF} className={`shrink-0 ${breadcrumbLinkClass}`}>
          Crypto
        </Link>
        {breadcrumbSep}
        <span
          className="min-w-0 shrink-0 truncate font-medium text-fg"
          title={pairLabel}
          aria-current="page"
        >
          {pairLabel}
        </span>
      </div>
    </AssetBreadcrumbBar>
  );
}
