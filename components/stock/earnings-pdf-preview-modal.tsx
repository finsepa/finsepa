"use client";

import { useCallback, useEffect, useState } from "react";

import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import { AppModalCloseButton, AppModalShell } from "@/components/ui/app-modal-shell";
import { SegmentedControl } from "@/components/design-system";
import { EarningsFreePdfTease } from "@/components/stock/earnings-free-pdf-tease";
import { EarningsProDocGateOverlay } from "@/components/stock/earnings-pro-doc-gate-overlay";
import {
  earningsDocumentPreviewKind,
  type EarningsDocumentPreviewKind,
} from "@/lib/market/earnings-document-url";
import { isIrPdfProxyUrlAllowed } from "@/lib/market/ir-pdf-proxy-allowlist";
import { isSecExhibitProxyUrlAllowed } from "@/lib/market/sec-exhibit-proxy-allowlist";

export type EarningsDocumentPreviewTab = {
  id: string;
  label: string;
  url: string;
};

type Props = {
  open: boolean;
  title: string;
  /** Public HTTPS URL of the document */
  sourceUrl: string | null;
  /** When two SEC reports exist, show an internal 8-K | 10-Q/10-K toggle. Default is the first tab. */
  tabs?: readonly EarningsDocumentPreviewTab[];
  onClose: () => void;
  /**
   * Free: blur + Pro → View plans.
   * SEC HTML: real iframe under blur. PDF: canvas tease (no Chromium download chrome).
   */
  proGate?: boolean;
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
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(absolute)}`;
  }
  return null;
}

export function EarningsPdfPreviewModal({ open, title, sourceUrl, tabs, onClose, proGate = false }: Props) {
  const tabList = tabs && tabs.length >= 2 ? tabs : null;
  const [activeTabId, setActiveTabId] = useState(tabList?.[0]?.id ?? "");

  useEffect(() => {
    if (!open) return;
    setActiveTabId(tabList?.[0]?.id ?? "");
  }, [open, tabList?.[0]?.id, sourceUrl]);

  const activeTab = tabList?.find((t) => t.id === activeTabId) ?? tabList?.[0] ?? null;
  const resolvedUrl = activeTab?.url ?? sourceUrl;
  const resolvedTitle = activeTab ? `${title} · ${activeTab.label}` : title;

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

  if (!open || !resolvedUrl) return null;

  const kind = earningsDocumentPreviewKind(resolvedUrl);
  const proxySrc = kind ? toProxySrc(resolvedUrl, kind) : null;

  // Pro (or Free SEC HTML): native iframe. Free PDF: canvas tease — Chromium PDF UI allows download.
  const useIframe = Boolean(proxySrc) && (!proGate || kind === "sec-html");
  const usePdfTease = Boolean(proGate && kind === "pdf" && proxySrc);

  return (
    <AppModalOverlay open={open} onClose={onClose} zIndex={300}>
      <AppModalShell
        titleId="earnings-pdf-preview-title"
        maxWidthClass="w-full max-w-[min(1120px,calc(100vw-1.5rem))]"
        maxHeightClass="h-[min(90vh,880px)]"
        bodyScroll={false}
        header={
          <div className="flex w-full min-w-0 items-center justify-between gap-3">
            <h2
              id="earnings-pdf-preview-title"
              className="min-w-0 truncate text-[16px] font-semibold leading-6 text-fg sm:text-[17px]"
            >
              {tabList ? title : resolvedTitle}
            </h2>
            <div className="flex shrink-0 items-center gap-1">
              {tabList ? (
                <SegmentedControl
                  aria-label="Report documents"
                  options={tabList.map((t) => ({ value: t.id, label: t.label }))}
                  value={activeTab?.id ?? tabList[0]!.id}
                  onChange={setActiveTabId}
                />
              ) : null}
              {tabList ? <span className="mx-0.5 h-4 w-px shrink-0 bg-stroke" aria-hidden /> : null}
              <AppModalCloseButton onClick={onClose} />
            </div>
          </div>
        }
        headerClassName="px-4 py-3 sm:px-5"
        bodyClassName="relative min-h-0 flex-1 overflow-hidden bg-surface-muted p-0"
        cardClassName="overflow-hidden"
      >
        <div className="absolute inset-0 overflow-hidden">
          {useIframe && proxySrc ? (
            <iframe
              title={resolvedTitle}
              className="h-full min-h-[240px] w-full border-0"
              src={proxySrc}
              style={proGate ? { pointerEvents: "none" } : undefined}
            />
          ) : usePdfTease && proxySrc ? (
            <EarningsFreePdfTease proxySrc={proxySrc} label={title} />
          ) : (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 px-4 text-center text-[14px] text-fg-muted">
              <p>Preview is not available for this host.</p>
              {proGate ? null : (
                <a href={resolvedUrl} className="font-semibold text-fg underline" target="_blank" rel="noopener noreferrer">
                  Open in new tab
                </a>
              )}
            </div>
          )}
          <EarningsProDocGateOverlay active={proGate} />
        </div>
      </AppModalShell>
    </AppModalOverlay>
  );
}
