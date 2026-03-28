"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";

import { LogoSkeleton, SparklineSkeleton, SkeletonBox } from "@/components/markets/skeleton";
import { WatchlistStarButton } from "@/components/watchlist/watchlist-star-button";
import { cryptoWatchlistKey } from "@/lib/watchlist/constants";
import type { CryptoAssetLinks, CryptoAssetRow } from "@/lib/market/crypto-asset";

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

function BigSparkline({ points, positive }: { points: number[]; positive: boolean }) {
  const w = 320;
  const h = 110;
  const series = points.length >= 2 ? points : points.length === 1 ? [points[0]!, points[0]!] : [0, 0];
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;

  const pts = series.map((p, i) => {
    const x = (i / (series.length - 1)) * w;
    const y = h - ((p - min) / range) * (h - 16) - 8;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const polyline = pts.join(" ");
  const fillPath = `M${pts[0]} L${pts.slice(1).join(" L")} L${w},${h} L0,${h} Z`;

  const stroke = positive ? "#16A34A" : "#DC2626";
  const fill = positive ? "rgba(22,163,74,0.10)" : "rgba(220,38,38,0.10)";
  const lastPt = pts[pts.length - 1]?.split(",") ?? ["0", "0"];

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" className="w-full">
      <path d={fillPath} fill={fill} />
      <polyline points={polyline} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastPt[0]} cy={lastPt[1]} r="3.5" fill={stroke} />
    </svg>
  );
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
  const symUpper = routeSymbol.trim().toUpperCase();
  const wlKey = cryptoWatchlistKey(symUpper);

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
  const positive = safeRow?.changePercent1D != null ? safeRow.changePercent1D >= 0 : (safeRow?.sparkline5d.at(-1) ?? 0) >= (safeRow?.sparkline5d[0] ?? 0);

  const priceDerived = useMemo(() => {
    if (safeRow?.price == null || safeRow.changePercent1D == null) return { change: null, isPositive: true };
    const change = (safeRow.price * safeRow.changePercent1D) / 100;
    return { change, isPositive: change >= 0 };
  }, [safeRow?.price, safeRow?.changePercent1D]);

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
          {loading ? (
            <SkeletonBox className="h-9 w-40 rounded-md" />
          ) : safeRow ? (
            <>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-[28px] font-semibold leading-9 tabular-nums text-[#09090B]">
                  {safeRow.price == null || !Number.isFinite(safeRow.price)
                    ? "—"
                    : `$${safeRow.price.toLocaleString("en-US", { maximumFractionDigits: safeRow.price < 1 ? 4 : 2 })}`}
                </span>
                <span
                  className={`text-[15px] font-medium tabular-nums ${
                    priceDerived.isPositive ? "text-[#16A34A]" : "text-[#DC2626]"
                  }`}
                >
                  {safeRow.changePercent1D == null || priceDerived.change == null
                    ? "—"
                    : `${priceDerived.isPositive ? "+" : ""}${priceDerived.change.toLocaleString("en-US", {
                        maximumFractionDigits: safeRow.price! < 1 ? 6 : 2,
                      })} (${priceDerived.isPositive ? "+" : ""}${safeRow.changePercent1D.toFixed(2)}%)`}
                </span>
                <span className="text-[13px] text-[#71717A]">1D</span>
              </div>
              <div className="mt-0.5 text-[12px] text-[#71717A]">{loading ? "Loading…" : "USD"}</div>
            </>
          ) : null}
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-xl border border-[#E4E4E7] bg-white px-4 py-4">
        {loading ? (
          <SparklineSkeleton className="h-28 w-full" />
        ) : safeRow ? (
          safeRow.sparkline5d.length ? (
            <BigSparkline points={safeRow.sparkline5d} positive={positive} />
          ) : (
            <div className="h-28" />
          )
        ) : (
          <div className="h-28" />
        )}
      </div>

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
