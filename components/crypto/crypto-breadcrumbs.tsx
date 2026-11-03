"use client";

import Link from "next/link";

import { CompanyLogo } from "@/components/screener/company-logo";
import { AssetBreadcrumbBar } from "@/components/stock/asset-breadcrumb-bar";
import { getCryptoLogoUrl } from "@/lib/crypto/crypto-logo-url";
import { eodhdCryptoSpotTickerDisplay } from "@/lib/crypto/eodhd-crypto-ticker-display";
import { SCREENER_CRYPTO_HREF } from "@/lib/screener/screener-market-url";

type Props = {
  symbol: string;
  logoUrl?: string | null;
  embedded?: boolean;
};

export function CryptoBreadcrumbs({ symbol, logoUrl = null, embedded = false }: Props) {
  const sym = symbol.trim().toUpperCase();
  const pairLabel = eodhdCryptoSpotTickerDisplay(sym);
  const resolvedLogo = logoUrl?.trim() || getCryptoLogoUrl(sym);

  const breadcrumbLinkClass =
    "min-w-0 truncate transition-colors hover:text-fg hover:underline";
  const breadcrumbSep = (
    <span className="shrink-0 select-none" aria-hidden>
      /
    </span>
  );

  return (
    <AssetBreadcrumbBar embedded={embedded}>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:flex-nowrap">
        <Link href={SCREENER_CRYPTO_HREF} className={`shrink-0 ${breadcrumbLinkClass}`}>
          Crypto
        </Link>
        {breadcrumbSep}
        <span
          className="inline-flex shrink-0 items-center gap-1.5 font-medium text-fg"
          title={pairLabel}
          aria-current="page"
        >
          <CompanyLogo name={pairLabel} logoUrl={resolvedLogo} symbol={sym} size="xs" />
          {pairLabel}
        </span>
      </div>
    </AssetBreadcrumbBar>
  );
}
