"use client";

import { useState } from "react";
import { FileSearch, Presentation } from "lucide-react";

import { EarningsPdfPreviewModal } from "@/components/stock/earnings-pdf-preview-modal";
import { getCuratedIrEarningsRowUrls } from "@/lib/market/earnings-ir-curated-lookup";
import { buildEarningsReportRowLinkTargets } from "@/lib/market/earnings-report-external-links";
import type { StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";
import { cn } from "@/lib/utils";

const outlineButtonClass =
  "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-[10px] border border-[#E4E4E7] bg-white px-3 font-['Inter'] text-[14px] font-normal leading-5 text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-colors duration-100 hover:bg-[#F4F4F5] active:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/10 focus-visible:ring-offset-2";

function isEdgarBrowseHtmlUrl(href: string): boolean {
  return href.includes("sec.gov") && (href.includes("/cgi-bin/browse-edgar") || href.includes("edgar/searchedgar/"));
}

function firstPartyEarningsDocumentUrls(
  listingTicker: string,
  row: StockEarningsHistoryRow,
): { slidesUrl: string | null; filingsUrl: string | null } {
  const curated = getCuratedIrEarningsRowUrls(listingTicker, row);
  if (curated) {
    return { slidesUrl: curated.presentationPdfUrl, filingsUrl: curated.quarterlyReportPdfUrl };
  }
  const s = row.secSlidesUrl;
  const f = row.secFilingsUrl;
  return {
    slidesUrl: s && s.startsWith("https://") && !isEdgarBrowseHtmlUrl(s) ? s : null,
    filingsUrl: f && f.startsWith("https://") && !isEdgarBrowseHtmlUrl(f) ? f : null,
  };
}

function secFallbackDocumentUrls(listingTicker: string, row: StockEarningsHistoryRow): { slidesUrl: string | null; filingsUrl: string | null } {
  if (!row.reportDateYmd) return { slidesUrl: null, filingsUrl: null };
  const t = buildEarningsReportRowLinkTargets(null, row.reportDateYmd, listingTicker);
  return { slidesUrl: t.slidesSec8k, filingsUrl: t.secFilings };
}

type PreviewState = { url: string; title: string } | null;

function ActionButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} className={outlineButtonClass} aria-label={label} title={label}>
      {children}
    </button>
  );
}

function ActionDisabled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(outlineButtonClass, "pointer-events-none cursor-not-allowed opacity-45")}
      aria-label={label}
      title={label}
    >
      {children}
    </span>
  );
}

function ActionLink({
  label,
  href,
  children,
}: {
  label: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={outlineButtonClass}
      aria-label={label}
      title={label}
    >
      {children}
    </a>
  );
}

type Props = {
  row: StockEarningsHistoryRow;
  listingTicker: string;
};

/**
 * Slides / Filings: in-app PDF preview (q4cdn, SEC PDFs) via `/api/ir-pdf` when proxied; otherwise “Open in new tab”.
 */
export function EarningsReportRowActions({ row, listingTicker }: Props) {
  /** Upcoming / unreleased quarters may have a future report date — no SEC window links until reported. */
  const released = row.reported;
  const { slidesUrl, filingsUrl } = firstPartyEarningsDocumentUrls(listingTicker, row);
  const secFallback = released ? secFallbackDocumentUrls(listingTicker, row) : { slidesUrl: null, filingsUrl: null };
  const [preview, setPreview] = useState<PreviewState>(null);

  const slidesHref = released ? (slidesUrl ?? secFallback.slidesUrl) : null;
  const filingsHref = released ? (filingsUrl ?? secFallback.filingsUrl) : null;

  const slidesDisabledLabel = released
    ? "No presentation link for this report"
    : "Presentation not available until this report is released";
  const filingsDisabledLabel = released
    ? "No quarterly report link for this report"
    : "Filings not available until this report is released";

  return (
    <>
      <EarningsPdfPreviewModal
        open={preview != null}
        title={preview?.title ?? "Document"}
        sourceUrl={preview?.url ?? null}
        onClose={() => setPreview(null)}
      />
      <div className="flex w-max max-w-full shrink-0 flex-nowrap items-center justify-end gap-2">
        {slidesHref ? (
          slidesUrl ? (
            <ActionButton
              label="Open earnings presentation preview"
              onClick={() => setPreview({ url: slidesUrl, title: "Earnings presentation" })}
            >
              <Presentation className="h-4 w-4 shrink-0 text-[#52525B]" aria-hidden />
              <span>Slides</span>
            </ActionButton>
          ) : (
            <ActionLink label="Open SEC 8-K window" href={slidesHref}>
              <Presentation className="h-4 w-4 shrink-0 text-[#52525B]" aria-hidden />
              <span>Slides</span>
            </ActionLink>
          )
        ) : (
          <ActionDisabled label={slidesDisabledLabel}>
            <Presentation className="h-4 w-4 shrink-0" aria-hidden />
            <span>Slides</span>
          </ActionDisabled>
        )}
        {filingsHref ? (
          filingsUrl ? (
            <ActionButton
              label="Open quarterly report preview"
              onClick={() => setPreview({ url: filingsUrl, title: "Quarterly report" })}
            >
              <FileSearch className="h-4 w-4 shrink-0 text-[#52525B]" aria-hidden />
              <span>Filings</span>
            </ActionButton>
          ) : (
            <ActionLink label="Open SEC filings" href={filingsHref}>
              <FileSearch className="h-4 w-4 shrink-0 text-[#52525B]" aria-hidden />
              <span>Filings</span>
            </ActionLink>
          )
        ) : (
          <ActionDisabled label={filingsDisabledLabel}>
            <FileSearch className="h-4 w-4 shrink-0" aria-hidden />
            <span>Filings</span>
          </ActionDisabled>
        )}
      </div>
    </>
  );
}
