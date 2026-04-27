"use client";

import { useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, X } from "lucide-react";

import { isIrPdfProxyUrlAllowed } from "@/lib/market/ir-pdf-proxy-allowlist";

type Props = {
  open: boolean;
  title: string;
  /** Public HTTPS URL of the PDF */
  sourceUrl: string | null;
  onClose: () => void;
};

function toProxySrc(absolute: string | null): string | null {
  if (!absolute || !isIrPdfProxyUrlAllowed(absolute)) return null;
  return `/api/ir-pdf?u=${encodeURIComponent(absolute)}`;
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
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [open, onKeyDown]);

  if (!open || !sourceUrl) return null;

  const iframeSrc = toProxySrc(sourceUrl);

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="earnings-pdf-preview-title"
    >
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <div
        className="relative z-10 flex h-[min(90vh,880px)] w-full max-w-[min(1120px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-[#E4E4E7] bg-white shadow-[0px_10px_16px_-3px_rgba(10,10,10,0.1),0px_4px_6px_0px_rgba(10,10,10,0.04)]"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#E4E4E7] px-4 py-3 sm:px-5">
          <h2
            id="earnings-pdf-preview-title"
            className="min-w-0 text-[16px] font-semibold leading-6 text-[#09090B] sm:text-[17px]"
          >
            {title}
          </h2>
          <div className="flex shrink-0 items-center gap-1">
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-[#E4E4E7] bg-white px-2.5 text-[12px] font-semibold text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-colors hover:bg-[#F4F4F5] sm:px-3"
              title="Open document in a new tab"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden sm:inline">New tab</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[#71717A] transition-colors hover:bg-[#F4F4F5] hover:text-[#09090B]"
              aria-label="Close"
            >
              <X className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 bg-[#F4F4F5]">
          {iframeSrc ? (
            <iframe title={title} className="h-full w-full border-0" src={iframeSrc} />
          ) : (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 px-4 text-center text-[14px] text-[#71717A]">
              <p>Preview is not available for this host.</p>
              <a href={sourceUrl} className="font-semibold text-[#09090B] underline" target="_blank" rel="noopener noreferrer">
                Open in new tab
              </a>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
