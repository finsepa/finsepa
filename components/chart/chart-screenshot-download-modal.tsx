"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChartScreenshotPreview } from "@/components/chart/chart-screenshot-preview";
import { ChartScreenshotExportSettings } from "@/components/chart/chart-screenshot-export-settings";
import { ChartScreenshotPreviewZoomControls } from "@/components/chart/chart-screenshot-preview-zoom-controls";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import {
  AppModalFooter,
  AppModalShell,
  appModalCancelButtonClass,
  appModalPrimaryButtonClass,
} from "@/components/ui/app-modal-shell";
import {
  CHART_SCREENSHOT_PREVIEW_PANE_PADDING_PX,
  CHART_SCREENSHOT_PREVIEW_SIDE_GREY_PX,
  CHART_SCREENSHOT_PREVIEW_ZOOM_DEFAULT_PERCENT,
  chartScreenshotPreviewScale,
} from "@/lib/chart/chart-screenshot-constants";
import {
  chartScreenshotExportFilename,
  exportChartScreenshotJpeg,
} from "@/lib/chart/export-chart-screenshot-jpeg";
import {
  DEFAULT_CHART_SCREENSHOT_EXPORT_OPTIONS,
  chartScreenshotExportOptionsForSnapshot,
  type ChartScreenshotExportOptions,
} from "@/lib/chart/chart-screenshot-export-options";
import type { ChartScreenshotSnapshot } from "@/lib/chart/chart-screenshot-types";
import { stockOverviewExportMetricSlug } from "@/lib/chart/chart-screenshot-types";

const CHART_DOWNLOAD_MODAL_WIDTH_CLASS = "w-full max-w-[min(1400px,calc(100vw-2rem))]";
/** Fixed preview column height — keeps modal size stable when zoom changes. */
const CHART_DOWNLOAD_PREVIEW_BODY_HEIGHT_CLASS = "h-[min(680px,calc(90vh-9rem))]";

export function ChartScreenshotDownloadModal({
  open,
  onClose,
  snapshot,
  zIndex,
}: {
  open: boolean;
  onClose: () => void;
  snapshot: ChartScreenshotSnapshot | null;
  zIndex?: number;
}) {
  const previewPaneRef = useRef<HTMLDivElement>(null);
  const exportRootRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);
  const [previewZoomPercent, setPreviewZoomPercent] = useState(
    CHART_SCREENSHOT_PREVIEW_ZOOM_DEFAULT_PERCENT,
  );
  const [exporting, setExporting] = useState(false);
  const [exportOptions, setExportOptions] = useState<ChartScreenshotExportOptions>(
    DEFAULT_CHART_SCREENSHOT_EXPORT_OPTIONS,
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onKeyDown]);

  useEffect(() => {
    if (!open) {
      setExporting(false);
      return;
    }
    setPreviewZoomPercent(CHART_SCREENSHOT_PREVIEW_ZOOM_DEFAULT_PERCENT);
    setExportOptions(
      snapshot ? chartScreenshotExportOptionsForSnapshot(snapshot) : DEFAULT_CHART_SCREENSHOT_EXPORT_OPTIONS,
    );

    const pane = previewPaneRef.current;
    if (!pane) return;

    const updateScale = () => {
      const styles = getComputedStyle(pane);
      const paddingX =
        Number.parseFloat(styles.paddingLeft) + Number.parseFloat(styles.paddingRight);
      const paddingY =
        Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom);
      const contentWidth = Math.max(0, pane.clientWidth - paddingX);
      const contentHeight = Math.max(0, pane.clientHeight - paddingY);
      setFitScale(chartScreenshotPreviewScale(contentWidth, contentHeight));
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(pane);
    return () => observer.disconnect();
  }, [open, snapshot]);

  const handleExport = useCallback(async () => {
    const root = exportRootRef.current;
    if (!root || !snapshot || exporting) return;

    setExporting(true);
    try {
      await exportChartScreenshotJpeg(
        root,
        chartScreenshotExportFilename(
          snapshot.ticker,
          snapshot.variant === "keyStatsMetric"
            ? snapshot.keyStatsMetric?.metricId
            : snapshot.variant === "stockOverview" && snapshot.stockOverview
              ? stockOverviewExportMetricSlug(
                  snapshot.stockOverview.series,
                  snapshot.stockOverview.range,
                )
              : undefined,
        ),
      );
    } catch (err) {
      console.error("[chart-screenshot] export failed", err);
    } finally {
      setExporting(false);
    }
  }, [snapshot, exporting]);

  if (!open || !snapshot) return null;

  return (
    <AppModalOverlay open={open} onClose={onClose} zIndex={zIndex}>
      <AppModalShell
        title="Download"
        titleId="chart-screenshot-download-title"
        onClose={onClose}
        closeDisabled={exporting}
        maxWidthClass={CHART_DOWNLOAD_MODAL_WIDTH_CLASS}
        maxHeightClass="max-h-[min(92vh,960px)]"
        bodyScroll={false}
        bodyClassName="flex min-h-0 flex-1 flex-col p-0"
        footer={
          <AppModalFooter>
            <ChartScreenshotPreviewZoomControls
              value={previewZoomPercent}
              onChange={setPreviewZoomPercent}
              disabled={exporting}
            />
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                className={appModalCancelButtonClass}
                onClick={onClose}
                disabled={exporting}
              >
                Cancel
              </button>
              <button
                type="button"
                className={appModalPrimaryButtonClass(!exporting)}
                onClick={() => void handleExport()}
                disabled={exporting}
              >
                {exporting ? "Exporting…" : "Export"}
              </button>
            </div>
          </AppModalFooter>
        }
      >
        <div className={`flex shrink-0 ${CHART_DOWNLOAD_PREVIEW_BODY_HEIGHT_CLASS}`}>
          <div
            ref={previewPaneRef}
            className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-[#FAFAFA]"
            style={{ padding: CHART_SCREENSHOT_PREVIEW_PANE_PADDING_PX }}
          >
            <div
              className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-auto"
              style={{
                paddingLeft: CHART_SCREENSHOT_PREVIEW_SIDE_GREY_PX,
                paddingRight: CHART_SCREENSHOT_PREVIEW_SIDE_GREY_PX,
              }}
            >
              <ChartScreenshotPreview
                ref={exportRootRef}
                snapshot={snapshot}
                fitScale={fitScale}
                previewZoomPercent={previewZoomPercent}
                exportOptions={exportOptions}
              />
            </div>
          </div>
          <aside className="flex w-[320px] shrink-0 flex-col border-l border-[#E4E4E7] bg-white">
            <ChartScreenshotExportSettings
              value={exportOptions}
              onChange={setExportOptions}
              disabled={exporting}
              variant={snapshot.variant ?? "charting"}
            />
          </aside>
        </div>
      </AppModalShell>
    </AppModalOverlay>
  );
}
