"use client";

import { useState } from "react";
import { FileSearch, FileText, Presentation } from "@/lib/icons";

import { usePlanAccessOptional } from "@/components/account/plan-access-provider";
import {
  EarningsPdfPreviewModal,
  type EarningsDocumentPreviewTab,
} from "@/components/stock/earnings-pdf-preview-modal";
import { EarningsTranscriptModal } from "@/components/stock/earnings-transcript-modal";
import { TopbarDelayedTooltip } from "@/components/layout/topbar-delayed-tooltip";
import { getCuratedIrEarningsRowUrls } from "@/lib/market/earnings-ir-curated-lookup";
import {
  earningsDocumentPreviewKind,
  isEarningsSlidesPreviewUrl,
} from "@/lib/market/earnings-document-url";
import { getEarningsTranscript } from "@/lib/market/earnings-transcript";
import type { EarningsTranscript } from "@/lib/market/earnings-transcript-types";
import type { StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";
import { secondaryOutlineButtonClassName } from "@/components/design-system";
import { cn } from "@/lib/utils";

const iconButtonClass = cn(
  secondaryOutlineButtonClassName,
  "size-8 min-w-0 gap-0 p-0 active:bg-surface focus-visible:ring-neutral-900/10",
);

function slidesUrlForRow(listingTicker: string, row: StockEarningsHistoryRow): string | null {
  const curated = getCuratedIrEarningsRowUrls(listingTicker, row);
  const rowSlides =
    row.secSlidesUrl &&
    row.secSlidesUrl.startsWith("https://") &&
    isEarningsSlidesPreviewUrl(row.secSlidesUrl)
      ? row.secSlidesUrl
      : null;
  return (
    (curated?.presentationPdfUrl && isEarningsSlidesPreviewUrl(curated.presentationPdfUrl)
      ? curated.presentationPdfUrl
      : null) ?? rowSlides
  );
}

function previewable(url: string | null): url is string {
  return url != null && earningsDocumentPreviewKind(url) != null;
}

type PreviewState = {
  url: string;
  title: string;
  tabs?: EarningsDocumentPreviewTab[];
} | null;

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
    <TopbarDelayedTooltip label={label} className="shrink-0">
      <button type="button" onClick={onClick} className={iconButtonClass} aria-label={label}>
        {children}
      </button>
    </TopbarDelayedTooltip>
  );
}

type Props = {
  row: StockEarningsHistoryRow;
  listingTicker: string;
};

/**
 * Slides (Company IR) + Reports (HIGH SEC 8-K / 10-Q/10-K) + curated transcript fixtures.
 * Free: open same modals with Pro blur gate (all quarters, incl. latest). Pro: full access.
 */
export function EarningsReportRowActions({ row, listingTicker }: Props) {
  const plan = usePlanAccessOptional();
  const released = row.reported;
  const slidesUrl = slidesUrlForRow(listingTicker, row);
  const eightKUrl = previewable(row.eightKUrl) ? row.eightKUrl : null;
  const form10Url = previewable(row.form10Url) ? row.form10Url : null;
  const form10Label = row.form10Kind === "10-K" ? "10-K" : "10-Q";
  const transcript = getEarningsTranscript(listingTicker, row);
  const [preview, setPreview] = useState<PreviewState>(null);
  const [transcriptOpen, setTranscriptOpen] = useState<EarningsTranscript | null>(null);

  const showSlides = released && previewable(slidesUrl);
  const showReportsPair = released && eightKUrl && form10Url;
  const showReportSingle = released && !showReportsPair && (eightKUrl != null || form10Url != null);
  const showTranscript = transcript != null;

  /** Free: every Transcript / Slides / Reports open is soft-gated (incl. latest). */
  const proGate = plan?.isPro !== true;

  if (!showSlides && !showReportsPair && !showReportSingle && !showTranscript) return null;

  const reportsTabs: EarningsDocumentPreviewTab[] | undefined = showReportsPair
    ? [
        { id: "8-k", label: "8-K", url: eightKUrl },
        { id: "form10", label: form10Label, url: form10Url },
      ]
    : undefined;

  const singleReportUrl = eightKUrl ?? form10Url;
  const singleReportTitle = eightKUrl ? "8-K" : form10Label;

  return (
    <>
      <EarningsPdfPreviewModal
        open={preview != null}
        title={preview?.title ?? "Document"}
        sourceUrl={preview?.url ?? null}
        tabs={preview?.tabs}
        onClose={() => setPreview(null)}
        proGate={proGate}
      />
      <EarningsTranscriptModal
        open={transcriptOpen != null}
        transcript={transcriptOpen}
        onClose={() => setTranscriptOpen(null)}
        proGate={proGate}
      />
      <div className="flex shrink-0 flex-nowrap items-center justify-end gap-2">
        {showTranscript ? (
          <ActionButton label="Transcript" onClick={() => setTranscriptOpen(transcript)}>
            <FileText className="h-4 w-4 shrink-0 text-fg-muted" aria-hidden />
          </ActionButton>
        ) : null}
        {showSlides ? (
          <ActionButton
            label="Slides"
            onClick={() => setPreview({ url: slidesUrl, title: "Slides" })}
          >
            <Presentation className="h-4 w-4 shrink-0 text-fg-muted" aria-hidden />
          </ActionButton>
        ) : null}
        {showReportsPair ? (
          <ActionButton
            label="Reports"
            onClick={() =>
              setPreview({
                url: eightKUrl,
                title: "Reports",
                tabs: reportsTabs,
              })
            }
          >
            <FileSearch className="h-4 w-4 shrink-0 text-fg-muted" aria-hidden />
          </ActionButton>
        ) : null}
        {showReportSingle && singleReportUrl ? (
          <ActionButton
            label="Report"
            onClick={() => setPreview({ url: singleReportUrl, title: singleReportTitle })}
          >
            <FileSearch className="h-4 w-4 shrink-0 text-fg-muted" aria-hidden />
          </ActionButton>
        ) : null}
      </div>
    </>
  );
}
