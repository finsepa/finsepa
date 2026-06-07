"use client";

import Link from "next/link";
import { Search } from "@/lib/icons";
import { useRouter, useSearchParams } from "next/navigation";

import { CompanyPicker } from "@/components/charting/company-picker";
import { portfolioHoldingAssetHref } from "@/lib/crypto/crypto-picker-universe";
import { eodhdCryptoSpotTickerDisplay } from "@/lib/crypto/eodhd-crypto-ticker-display";
import { SCREENER_CRYPTO_HREF } from "@/lib/screener/screener-market-url";

type Props = {
  symbol: string;
};

export function CryptoBreadcrumbs({ symbol }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sym = symbol.trim().toUpperCase();
  const pairLabel = eodhdCryptoSpotTickerDisplay(sym);

  const breadcrumbLinkClass =
    "min-w-0 truncate transition-colors hover:text-[#09090B] hover:underline";
  const breadcrumbSep = (
    <span className="shrink-0 select-none" aria-hidden>
      /
    </span>
  );

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-w-0 items-center gap-3 px-4 py-3 text-[14px] text-[#71717A] max-md:border-b-0 md:border-b md:border-[#E4E4E7] sm:px-9"
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:flex-nowrap">
        <Link href={SCREENER_CRYPTO_HREF} className={`shrink-0 ${breadcrumbLinkClass}`}>
          Crypto
        </Link>
        {breadcrumbSep}
        <div className="shrink-0">
          <CompanyPicker
            includeCrypto
            alwaysAllowOpen
            menuAlign="trailing"
            menuPortal
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
    </nav>
  );
}
