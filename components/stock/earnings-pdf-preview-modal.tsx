"use client";

import { useCallback, useEffect } from "react";

import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import { AppModalCloseButton, AppModalShell } from "@/components/ui/app-modal-shell";
import {
  earningsDocumentPreviewKind,
  type EarningsDocumentPreviewKind,
} from "@/lib/market/earnings-document-url";
import { isIrPdfProxyUrlAllowed } from "@/lib/market/ir-pdf-proxy-allowlist";
import { isSecExhibitProxyUrlAllowed } from "@/lib/market/sec-exhibit-proxy-allowlist";

type Props = {
  open: boolean;
  title: string;
  /** Public HTTPS URL of the document */
  sourceUrl: string | null;
  onClose: () => void;
};

function toProxySrc(absolute: string | null, kind: EarningsDocumentPreviewKind): string | null {
  if (!absolute) return null;
  if (kind === "pdf" && isIrPdfProxyUrlAllowed(absolute)) {
    return `/api/ir-pdf?u=${encodeURIComponent(absolute)}`;
  }
  if (kind === "sec-html" && isSecExhibitProxyUrlAllowed(absolute)) {
    return `/api/sec-exhibit?u=${encodeURIComponent(absolute)}`;
  }
  if (kind === "office") {
    // Microsoft Office Online embeds PPTX (and similar) decks that can't render in a raw iframe.
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(absolute)}`;
  }
  return null;
}

export function EarningsPdfPreviewModal({ open, title, sourceUrl, onClose }: Props) {
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onKeyDown]);

  if (!open || !sourceUrl) return null;

  const kind = earningsDocumentPreviewKind(sourceUrl);
  const iframeSrc = kind ? toProxySrc(sourceUrl, kind) : null;

  return (
    <AppModalOverlay open={open} onClose={onClose} zIndex={300}>
      <AppModalShell
        titleId="earnings-pdf-preview-title"
        maxWidthClass="w-full max-w-[min(1120px,calc(100vw-1.5rem))]"
        maxHeightClass="h-[min(90vh,880px)]"
        bodyScroll={false}
        header={
          <div className="flex w-full items-center justify-between gap-3">
            <h2
              id="earnings-pdf-preview-title"
              className="min-w-0 text-[16px] font-semibold leading-6 text-fg sm:text-[17px]"
            >
              {title}
            </h2>
            <AppModalCloseButton onClick={onClose} />
          </div>
        }
        headerClassName="px-4 py-3 sm:px-5"
        bodyClassName="min-h-0 flex-1 bg-surface-muted p-0"
        cardClassName="overflow-hidden"
      >
        {iframeSrc ? (
          <iframe title={title} className="h-full min-h-[240px] w-full border-0" src={iframeSrc} />
        ) : (
          <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 px-4 text-center text-[14px] text-fg-muted">
            <p>Preview is not available for this host.</p>
            <a href={sourceUrl} className="font-semibold text-fg underline" target="_blank" rel="noopener noreferrer">
              Open in new tab
            </a>
          </div>
        )}
      </AppModalShell>
    </AppModalOverlay>
  );
}
