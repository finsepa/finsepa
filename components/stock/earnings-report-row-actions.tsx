"use client";

import { useState } from "react";
import { FileSearch, Presentation } from "@/lib/icons";

import { EarningsPdfPreviewModal } from "@/components/stock/earnings-pdf-preview-modal";
import { getCuratedIrEarningsRowUrls } from "@/lib/market/earnings-ir-curated-lookup";
import {
  earningsDocumentPreviewKind,
  isEarningsFilingsPreviewUrl,
  isEarningsSlidesPreviewUrl,
} from "@/lib/market/earnings-document-url";
import type { StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";
import { secondaryOutlineButtonClassName } from "@/components/design-system";
import { cn } from "@/lib/utils";

const outlineButtonClass = cn(
  secondaryOutlineButtonClassName,
  "font-['Inter'] text-[14px] font-normal leading-5 active:bg-white focus-visible:ring-neutral-900/10",
);

function firstPartyEarningsDocumentUrls(
  listingTicker: string,
  row: StockEarningsHistoryRow,
): { slidesUrl: string | null; filingsUrl: string | null } {
  const curated = getCuratedIrEarningsRowUrls(listingTicker, row);
  if (curated) {
    return {
      slidesUrl: curated.presentationPdfUrl ?? null,
      filingsUrl: curated.quarterlyReportPdfUrl ?? null,
    };
  }
  const s = row.secSlidesUrl;
  const f = row.secFilingsUrl;
  return {
    slidesUrl: s && s.startsWith("https://") && isEarningsSlidesPreviewUrl(s) ? s : null,
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
 * Slides / Filings — in-app preview when a PDF, SEC HTML exhibit, or known PPTX deck URL is known.
 * PDFs use `/api/ir-pdf`; SEC HTML uses `/api/sec-exhibit`; PPTX decks use Office Online embed.
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
