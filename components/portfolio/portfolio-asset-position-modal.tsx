"use client";

import { useEffect } from "react";
import Link from "next/link";

import { AssetPositionDetail } from "@/components/portfolio/asset-portfolio-holdings-tab";
import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { CompanyLogo } from "@/components/screener/company-logo";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import { AppModalCloseButton, AppModalShell } from "@/components/ui/app-modal-shell";
import { isSupportedCryptoAssetSymbol } from "@/lib/crypto/crypto-logo-url";
import { cryptoRouteBase } from "@/lib/crypto/crypto-symbol-base";

export function PortfolioAssetPositionModal({
  holding,
  holdings,
  transactions,
  companyName,
  caption,
  logoUrl,
  assetHref,
  onClose,
}: {
  holding: PortfolioHolding | null;
  holdings: PortfolioHolding[];
  transactions: PortfolioTransaction[];
  companyName: string;
  caption: string;
  logoUrl: string;
  /** Full asset page (Portfolio tab). */
  assetHref: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!holding) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [holding, onClose]);

  if (!holding) return null;

  const cryptoKey = cryptoRouteBase(holding.symbol);
  const assetKind: "stock" | "crypto" = isSupportedCryptoAssetSymbol(cryptoKey) ? "crypto" : "stock";
  const routeKey = assetKind === "crypto" ? cryptoKey : holding.symbol.trim().toUpperCase();

  const titleInner = (
    <>
      <CompanyLogo name={companyName} logoUrl={logoUrl} symbol={holding.symbol} size="lg" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[18px] font-semibold leading-7 text-fg underline-offset-2 decoration-fg group-hover:underline">
          {caption}
        </span>
        <span className="min-w-0 truncate text-[14px] leading-5 text-fg-muted underline-offset-2 decoration-fg-muted group-hover:underline">
          {companyName}
        </span>
      </span>
    </>
  );

  return (
    <AppModalOverlay open onClose={onClose} zIndex={300}>
      <AppModalShell
        titleId="portfolio-asset-position-title"
        maxWidthClass="w-full"
        style={{ maxWidth: "min(1180px, calc(100vw - 2rem))" }}
        maxHeightClass="max-h-[min(90vh,880px)]"
        header={
          <div className="flex w-full items-center gap-3">
            {assetHref ? (
              <Link
                href={assetHref}
                onClick={onClose}
                id="portfolio-asset-position-title"
                title={`Open ${caption}`}
                className="group flex min-w-0 flex-1 cursor-pointer items-start gap-3 rounded-[10px] outline-none ring-offset-2 transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-fg/15"
              >
                {titleInner}
              </Link>
            ) : (
              <div id="portfolio-asset-position-title" className="flex min-w-0 flex-1 items-start gap-3">
                {titleInner}
              </div>
            )}
            <AppModalCloseButton onClick={onClose} />
          </div>
        }
        headerClassName="px-5 py-4"
        bodyClassName="min-h-0 min-w-0 px-5 pb-5 pt-4"
        cardClassName="overflow-hidden shadow-none"
      >
        <AssetPositionDetail
          assetKind={assetKind}
          routeKey={routeKey}
          holding={holding}
          holdings={holdings}
          transactions={transactions}
        />
      </AppModalShell>
    </AppModalOverlay>
  );
}
