import Link from "next/link";
import { format, isValid, parseISO } from "date-fns";

import { Superinvestor13fProfileTabs } from "@/components/superinvestors/superinvestor-13f-profile-tabs";
import { SuperinvestorFollowButton } from "@/components/superinvestors/superinvestor-follow-button";
import { SuperinvestorProfileAllocationDonut } from "@/components/superinvestors/superinvestor-profile-allocation-donut";
import { SuperinvestorProfileAvatar } from "@/components/superinvestors/superinvestor-profile-avatar";
import type { Berkshire13fComparisonPayload, SuperinvestorTransactionsPayload } from "@/lib/superinvestors/types";
import { formatUsdCompactSigDigits } from "@/lib/market/key-stats-basic-format";

export type Superinvestor13fProfileProps = {
  profileSlug: string;
  profileName: string;
  /** Breadcrumb segment after Superinvestors (e.g. Warren Buffett). */
  breadcrumbCurrentLabel: string;
  /** Public path under `/public`. When omitted, a generic placeholder is shown. */
  avatarSrc?: string | null;
  /** 3–5 line bio shown under header stats. */
  profileDescription?: string;
  data: Berkshire13fComparisonPayload;
  transactions: SuperinvestorTransactionsPayload;
};

/** SEC filer line → readable subtitle (e.g. `BERKSHIRE HATHAWAY INC` → `Berkshire Hathaway`). */
function filerSubtitle(secName: string): string {
  const words = secName
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  const joined = words.join(" ");
  return joined.replace(/\s+Inc\.?$/i, "").trim() || joined;
}

/** Match design: `$279.2 B` (space before unit suffix); mantissa ≤ 4 significant digits. */
function formatSizeForHeader(n: number): string {
  return formatUsdCompactSigDigits(n, 4).replace(/(\$[\d.]+)([KMBT])$/, "$1 $2");
}

function formatLastUpdateLabel(ymd: string | null): string {
  if (!ymd?.trim()) return "—";
  const d = parseISO(ymd.trim());
  if (!isValid(d)) return ymd.trim();
  return format(d, "MMM d, yyyy");
}

function ProfileHeaderDescription({ text }: { text: string }) {
  if (!text.trim()) return null;
  return (
    <p className="mt-4 max-w-3xl text-[14px] font-normal leading-5 text-[#71717A] sm:mt-5">{text}</p>
  );
}

function ProfileHeaderStats({
  sizeLabel,
  stocksLabel,
  lastUpdateLabel,
}: {
  sizeLabel: string;
  stocksLabel: string;
  lastUpdateLabel: string;
}) {
  return (
    <dl className="mt-4 flex w-full max-w-3xl flex-row items-stretch gap-0 sm:mt-5">
      <div className="flex min-w-0 flex-1 flex-col gap-1 border-r border-[#E4E4E7] pr-4 sm:pr-8">
        <dt className="text-[13px] font-normal leading-5 text-[#71717A]">Size</dt>
        <dd className="text-[16px] font-semibold leading-6 tabular-nums text-[#09090B] sm:text-[20px] sm:leading-7">
          {sizeLabel}
        </dd>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 border-r border-[#E4E4E7] px-4 sm:px-8">
        <dt className="text-[13px] font-normal leading-5 text-[#71717A]">No. of stocks</dt>
        <dd className="text-[16px] font-semibold leading-6 tabular-nums text-[#09090B] sm:text-[20px] sm:leading-7">
          {stocksLabel}
        </dd>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 pl-4 sm:pl-8">
        <dt className="text-[13px] font-normal leading-5 text-[#71717A]">Last update</dt>
        <dd className="text-[16px] font-semibold leading-6 text-[#09090B] sm:text-[20px] sm:leading-7">
          {lastUpdateLabel}
        </dd>
      </div>
    </dl>
  );
}

export function Superinvestor13fProfile({
  profileSlug,
  profileName,
  breadcrumbCurrentLabel,
  avatarSrc,
  profileDescription = "",
  data,
  transactions,
}: Superinvestor13fProfileProps) {
  const sizeLabel = formatSizeForHeader(data.totalValueUsd);
  const stocksLabel = `${data.positionCount.toLocaleString("en-US")} ${data.positionCount === 1 ? "Stock" : "Stocks"}`;
  const lastUpdateLabel = formatLastUpdateLabel(data.current.filingDate ?? data.current.reportDate);
  const showAllocationDonut = data.source !== "unavailable" && data.rows.length > 0;

  const breadcrumbLinkClass =
    "min-w-0 truncate transition-colors hover:text-[#09090B] hover:underline";

  return (
    <div className="relative min-w-0">
      <nav
        aria-label="Breadcrumb"
        className="flex min-w-0 items-center px-4 py-3 text-[14px] text-[#71717A] max-md:border-b-0 md:border-b md:border-[#E4E4E7] sm:px-9"
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:flex-nowrap">
          <Link href="/superinvestors" className={`shrink-0 ${breadcrumbLinkClass}`}>
            Superinvestors
          </Link>
          <span className="shrink-0 select-none" aria-hidden>
            /
          </span>
          <span className="min-w-0 truncate font-medium text-[#09090B]" aria-current="page">
            {breadcrumbCurrentLabel}
          </span>
        </div>
      </nav>

      <div className="min-w-0 px-4 py-4 sm:px-9 sm:py-6">
      <header>
        {/* Mobile — stats directly under name */}
        <div className="sm:hidden">
          <div className="flex items-center gap-4">
            <SuperinvestorProfileAvatar src={avatarSrc?.trim() ?? ""} name={profileName} />
            <div className="min-w-0">
              <h1 className="text-[24px] font-semibold leading-8 tracking-tight text-[#09090B]">{profileName}</h1>
              <p className="mt-0.5 text-[14px] font-normal leading-5 text-[#71717A]">
                {filerSubtitle(data.filerDisplayName)}
              </p>
            </div>
          </div>
          <ProfileHeaderStats
            sizeLabel={sizeLabel}
            stocksLabel={stocksLabel}
            lastUpdateLabel={lastUpdateLabel}
          />
          <ProfileHeaderDescription text={profileDescription} />
          <SuperinvestorFollowButton className="mt-4 w-full" investorName={profileName} />
        </div>

        {/* Desktop — name + stats left, donut right */}
        <div className="hidden items-center justify-between gap-6 sm:flex">
          <div className="min-w-0 flex-1">
            <h1 className="text-[24px] font-semibold leading-8 tracking-tight text-[#09090B]">{profileName}</h1>
            <p className="mt-0.5 text-[14px] font-normal leading-5 text-[#71717A]">
              {filerSubtitle(data.filerDisplayName)}
            </p>
            <ProfileHeaderStats
              sizeLabel={sizeLabel}
              stocksLabel={stocksLabel}
              lastUpdateLabel={lastUpdateLabel}
            />
            <ProfileHeaderDescription text={profileDescription} />
            <SuperinvestorFollowButton className="mt-4" investorName={profileName} />
          </div>
          {showAllocationDonut ? (
            <SuperinvestorProfileAllocationDonut
              rows={data.rows}
              avatarSrc={avatarSrc}
              profileName={profileName}
            />
          ) : null}
        </div>
      </header>

      {data.source === "unavailable" ? (
        <p className="mt-4 max-w-3xl text-sm text-[#71717A]">
          13F holdings could not be loaded from the SEC right now. Try again later, or verify the filer has recent
          13F-HR filings.
        </p>
      ) : null}

      <Superinvestor13fProfileTabs
        profileSlug={profileSlug}
        profileName={profileName}
        data={data}
        transactions={transactions}
      />
      </div>
    </div>
  );
}
