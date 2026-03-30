"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";

import type { ChartDisplayState } from "@/components/chart/PriceChart";
import { PriceChart } from "@/components/chart/PriceChart";
import { LogoSkeleton, SkeletonBox } from "@/components/markets/skeleton";
import { ChartControls } from "@/components/stock/chart-controls";
import { WatchlistStarButton } from "@/components/watchlist/watchlist-star-button";
import { cryptoWatchlistKey } from "@/lib/watchlist/constants";
import type { CryptoAssetLinks, CryptoAssetRow } from "@/lib/market/crypto-asset";
import type { StockChartRange } from "@/lib/market/stock-chart-types";

function formatPercent(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function ChangeValue({ value }: { value: number | null }) {
  const missing = value == null || !Number.isFinite(value);
  const positive = !missing && value! >= 0;
  return (
    <span
      className={`inline-flex items-center font-medium tabular-nums ${
        missing ? "text-[#71717A]" : positive ? "text-[#16A34A]" : "text-[#DC2626]"
      }`}
    >
      {formatPercent(value)}
    </span>
  );
}

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

function StatCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-[#E4E4E7] bg-white px-4 py-3">
      <div className="text-[13px] font-medium text-[#71717A]">{label}</div>
      <div className="mt-1 text-[14px] font-semibold tabular-nums leading-6 text-[#09090B]">{value}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#71717A]">{children}</h2>;
}

function LinkChip({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-full border border-[#E4E4E7] bg-white px-3 py-1.5 text-[13px] font-medium text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)] transition-colors hover:border-neutral-300 hover:bg-neutral-50"
    >
      {label}
      <ExternalLink className="h-3 w-3 shrink-0 text-[#71717A]" aria-hidden />
    </a>
  );
}

function LinkGroup({ title, items }: { title: string; items: { label: string; href: string }[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="text-[13px] font-medium text-[#71717A]">{title}</div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <LinkChip key={item.href + item.label} href={item.href} label={item.label} />
        ))}
      </div>
    </div>
  );
}

function buildLinksSections(links: CryptoAssetLinks) {
  const official: { label: string; href: string }[] = [];
  if (links.website) official.push({ label: "Website", href: links.website });
  if (links.whitepaper) official.push({ label: "Whitepaper", href: links.whitepaper });
  if (links.github) official.push({ label: "GitHub", href: links.github });

  const network: { label: string; href: string }[] = [];
  links.explorers.forEach((url, i) => {
    network.push({
      label: links.explorers.length > 1 ? `Explorer ${i + 1}` : "Chain explorer",
      href: url,
    });
  });
  links.wallets.forEach((url, i) => {
    network.push({
      label: links.wallets.length > 1 ? `Wallet ${i + 1}` : "Supported wallet",
      href: url,
    });
  });

  const social: { label: string; href: string }[] = [];
  if (links.twitter) social.push({ label: "X (Twitter)", href: links.twitter });
  if (links.reddit) social.push({ label: "Reddit", href: links.reddit });
  if (links.telegram) social.push({ label: "Telegram", href: links.telegram });
  if (links.discord) social.push({ label: "Discord", href: links.discord });

  return { official, network, social };
}

export function CryptoPageContent({ routeSymbol }: { routeSymbol: string }) {
  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<CryptoAssetRow | null>(null);
  const [range, setRange] = useState<StockChartRange>("1Y");
  const [chartUi, setChartUi] = useState<ChartDisplayState>({
    loading: true,
    empty: true,
    displayPrice: null,
    displayChangePct: null,
    displayChangeAbs: null,
    isHovering: false,
    selectionActive: false,
    periodLabelOverride: null,
    priceTimestampLabel: null,
  });
  const symUpper = routeSymbol.trim().toUpperCase();
  const wlKey = cryptoWatchlistKey(symUpper);

  const onChartDisplay = useCallback((s: ChartDisplayState) => {
    setChartUi(s);
  }, []);

  const displayPrice = chartUi.displayPrice;
  const hasChartChange =
    chartUi.displayChangePct != null &&
    chartUi.displayChangeAbs != null &&
    Number.isFinite(chartUi.displayChangePct) &&
    Number.isFinite(chartUi.displayChangeAbs);
  const changePositive = hasChartChange ? chartUi.displayChangeAbs! >= 0 : true;

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/crypto/asset/${encodeURIComponent(routeSymbol)}`, { cache: "no-store" });
        if (!res.ok) {
          if (!mounted) return;
          setRow(null);
          setLoading(false);
          return;
        }
        const json = (await res.json()) as { row?: CryptoAssetRow };
        if (!mounted) return;
        setRow(json.row ?? null);
        setLoading(false);
      } catch {
        if (!mounted) return;
        setRow(null);
        setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [routeSymbol]);

  const safeRow = useMemo(() => row, [row]);

  const linkSections = safeRow ? buildLinksSections(safeRow.links) : null;
  const hasAnyLinks =
    linkSections != null &&
    (linkSections.official.length > 0 || linkSections.network.length > 0 || linkSections.social.length > 0);

  return (
    <div className="space-y-5 px-9 py-6">
      {/* Header — aligned with stock detail */}
      <div className="space-y-3">
        <div className="flex items-center">
          <div className="flex items-center gap-1 text-[14px] text-[#71717A]">
            <Link href="/screener" className="transition-colors hover:text-[#09090B]">
              Markets
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="font-medium text-[#09090B]">{symUpper}</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            {loading ? (
              <LogoSkeleton sizeClass="h-12 w-12" />
            ) : safeRow?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- remote logo
              <img
                src={safeRow.logoUrl}
                alt=""
                width={48}
                height={48}
                className="h-12 w-12 shrink-0 rounded-xl border border-neutral-200 bg-white object-contain shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : null}
            {!loading && safeRow && !safeRow.logoUrl ? (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#E4E4E7] bg-[#F4F4F5] text-[18px] font-bold text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]">
                {safeRow.symbol.slice(0, 1)}
              </div>
            ) : null}

            <div className="min-w-0">
              {loading ? (
                <>
                  <SkeletonBox className="h-7 w-40 rounded-md" />
                  <SkeletonBox className="mt-1 h-4 w-24 rounded-md" />
                </>
              ) : safeRow ? (
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-[20px] font-semibold leading-7 text-[#09090B]">{safeRow.name}</h1>
                  <span className="text-[14px] font-medium text-[#71717A]">{safeRow.symbol}</span>
                </div>
              ) : (
                <div className="text-[14px] text-[#71717A]">Not available</div>
              )}
            </div>
          </div>

          <div className="shrink-0">
            <WatchlistStarButton variant="detail" storageKey={wlKey} label={symUpper} />
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-[28px] font-semibold leading-9 tabular-nums text-[#09090B]">
              {chartUi.loading || displayPrice == null ? "—" : formatCryptoUsd(displayPrice)}
            </span>
            <span
              className={`text-[15px] font-medium tabular-nums ${
                hasChartChange ? (changePositive ? "text-[#16A34A]" : "text-[#DC2626]") : "text-[#71717A]"
              }`}
            >
              {chartUi.loading || !hasChartChange
                ? "—"
                : `${changePositive ? "+" : ""}${formatCryptoChangeAbs(chartUi.displayChangeAbs, displayPrice)} (${changePositive ? "+" : ""}${chartUi.displayChangePct!.toFixed(2)}%)`}
            </span>
            <span className="text-[13px] text-[#71717A]">{chartUi.periodLabelOverride ?? range}</span>
          </div>
          {chartUi.loading ? (
            <div className="mt-0.5 text-[12px] text-[#71717A]">Loading…</div>
          ) : chartUi.empty ? null : chartUi.priceTimestampLabel ? (
            <div className="mt-0.5 text-[12px] leading-4 text-[#71717A]">{chartUi.priceTimestampLabel}</div>
          ) : null}
        </div>
      </div>

      <ChartControls activeRange={range} onRangeChange={setRange} />
      <PriceChart kind="crypto" symbol={symUpper} range={range} onDisplayChange={onChartDisplay} />

      {/* Performance snapshot */}
      {!loading && safeRow ? (
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="1D %" value={<ChangeValue value={safeRow.changePercent1D} />} />
          <StatCard label="1M %" value={<ChangeValue value={safeRow.changePercent1M} />} />
          <StatCard label="YTD %" value={<ChangeValue value={safeRow.changePercentYTD} />} />
        </div>
      ) : loading ? (
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-[#E4E4E7] bg-white px-4 py-3">
              <SkeletonBox className="h-4 w-16 rounded" />
              <SkeletonBox className="mt-2 h-6 w-20 rounded-md" />
            </div>
          ))}
        </div>
      ) : null}

      {/* General / Supply / Volume */}
      {!loading && safeRow ? (
        <div className="space-y-6">
          <div className="space-y-3">
            <SectionTitle>General</SectionTitle>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard label="Market Cap" value={safeRow.marketCap || "-"} />
              <StatCard label="Fully Diluted Market Cap" value={safeRow.fullyDilutedMarketCap} />
              <StatCard label="ATH Market Cap" value={safeRow.athMarketCap} />
            </div>
          </div>

          <div className="space-y-3">
            <SectionTitle>Supply</SectionTitle>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard label="Total Supply" value={safeRow.totalSupply} />
              <StatCard label="Circulating Supply" value={safeRow.circulatingSupply} />
              <StatCard label="Max Supply" value={safeRow.maxSupply} />
            </div>
          </div>

          <div className="space-y-3">
            <SectionTitle>Volume</SectionTitle>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <StatCard label="Volume (24h)" value={safeRow.volume24h} />
              <StatCard label="Volume / Market Cap (24h)" value={safeRow.volumeToMarketCap24h} />
            </div>
          </div>
        </div>
      ) : null}

      {/* Links */}
      {!loading && safeRow && linkSections && hasAnyLinks ? (
        <div className="space-y-5 border-t border-[#E4E4E7] pt-6">
          <LinkGroup title="Official links" items={linkSections.official} />
          <LinkGroup title="Network information" items={linkSections.network} />
          <LinkGroup title="Socials" items={linkSections.social} />
        </div>
      ) : null}
    </div>
  );
}
