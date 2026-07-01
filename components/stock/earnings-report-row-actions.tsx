"use client";

import { useState } from "react";
import { FileSearch, Presentation } from "@/lib/icons";

import { EarningsPdfPreviewModal } from "@/components/stock/earnings-pdf-preview-modal";
import { getCuratedIrEarningsRowUrls } from "@/lib/market/earnings-ir-curated-lookup";
import {
  earningsDocumentPreviewKind,
  isDirectEarningsPdfUrl,
  isEarningsFilingsPreviewUrl,
} from "@/lib/market/earnings-document-url";
import type { StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";
import { cn } from "@/lib/utils";

const outlineButtonClass =
  "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-[10px] border border-[#E4E4E7] bg-white px-3 font-['Inter'] text-[14px] font-normal leading-5 text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-colors duration-100 hover:bg-[#F4F4F5] active:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/10 focus-visible:ring-offset-2";

function isEdgarBrowseHtmlUrl(href: string): boolean {
  return href.includes("sec.gov") && (href.includes("/cgi-bin/browse-edgar") || href.includes("edgar/searchedgar/"));
}

function isDirectPdfUrl(href: string): boolean {
  if (isEdgarBrowseHtmlUrl(href)) return false;
  if (isDirectEarningsPdfUrl(href)) return true;
  return href.includes("sec.gov/Archives/edgar/") && /\.pdf/i.test(href);
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
    slidesUrl: s && s.startsWith("https://") && isDirectPdfUrl(s) ? s : null,
    filingsUrl: isEarningsFilingsPreviewUrl(f) ? f : null,
  };
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

type Props = {
  row: StockEarningsHistoryRow;
  listingTicker: string;
};

/**
 * Slides / Filings — in-app preview when a direct PDF or SEC Exhibit 99.1 HTML URL is known.
 * PDFs use `/api/ir-pdf`; SEC HTML exhibits use `/api/sec-exhibit`.
 */
export function EarningsReportRowActions({ row, listingTicker }: Props) {
  const released = row.reported;
  const { slidesUrl, filingsUrl } = firstPartyEarningsDocumentUrls(listingTicker, row);
  const [preview, setPreview] = useState<PreviewState>(null);

  const slidesDisabledLabel = released
    ? "No presentation PDF for this report yet"
    : "Presentation not available until this report is released";
  const filingsDisabledLabel = released
    ? "No quarterly report for this report yet"
    : "Filings not available until this report is released";

  const canPreview = (url: string | null) => url != null && earningsDocumentPreviewKind(url) != null;

  return (
    <>
      <EarningsPdfPreviewModal
        open={preview != null}
        title={preview?.title ?? "Document"}
        sourceUrl={preview?.url ?? null}
        onClose={() => setPreview(null)}
      />
      <div className="flex w-max max-w-full shrink-0 flex-nowrap items-center justify-end gap-2">
        {released && canPreview(slidesUrl) ? (
          <ActionButton
            label="Open earnings presentation preview"
            onClick={() => setPreview({ url: slidesUrl!, title: "Earnings presentation" })}
          >
            <Presentation className="h-4 w-4 shrink-0 text-[#52525B]" aria-hidden />
            <span>Slides</span>
          </ActionButton>
        ) : (
          <ActionDisabled label={slidesDisabledLabel}>
            <Presentation className="h-4 w-4 shrink-0" aria-hidden />
            <span>Slides</span>
          </ActionDisabled>
        )}
        {released && canPreview(filingsUrl) ? (
          <ActionButton
            label="Open quarterly report preview"
            onClick={() => setPreview({ url: filingsUrl!, title: "Quarterly report" })}
          >
            <FileSearch className="h-4 w-4 shrink-0 text-[#52525B]" aria-hidden />
            <span>Filings</span>
          </ActionButton>
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
