/** Logical screenshot frame (CSS px). */
export const CHART_SCREENSHOT_WIDTH_PX = 1200;
export const CHART_SCREENSHOT_HEIGHT_PX = 675;

/** Export at 2× pixel density (2400×1350 file). */
export const CHART_SCREENSHOT_EXPORT_PIXEL_RATIO = 2;

/** Even inset on all sides of the 1200×675 export frame. */
export const CHART_SCREENSHOT_FRAME_PADDING_PX = 18;

/** Slight inset so y-axis labels and legend stay inside the export frame. */
export const CHART_SCREENSHOT_CONTENT_SCALE = 0.98;

/** Logo + company name + ticker row at the top of the export frame. */
export const CHART_SCREENSHOT_ASSET_HEADER_HEIGHT_PX = 40;
export const CHART_SCREENSHOT_ASSET_HEADER_TOP_OFFSET_PX = 20;
export const CHART_SCREENSHOT_HEADER_CHART_GAP_PX = 12;

const CHART_SCREENSHOT_LEGEND_ROW_PX = 28;
const CHART_SCREENSHOT_CONTENT_GAP_PX = 6;

/** Padded content area below the asset header. */
export function chartScreenshotChartAreaSize(): { width: number; height: number } {
  const content = chartScreenshotContentBoxSize();
  const headerInset =
    CHART_SCREENSHOT_ASSET_HEADER_TOP_OFFSET_PX +
    CHART_SCREENSHOT_ASSET_HEADER_HEIGHT_PX +
    CHART_SCREENSHOT_HEADER_CHART_GAP_PX;
  return {
    width: content.width,
    height: content.height - headerInset,
  };
}

/** Chart block (plot + x-axis) sized to fill the chart area below the header. */
export function chartScreenshotChartBlockHeightPx(): number {
  const { height } = chartScreenshotChartAreaSize();
  return height - CHART_SCREENSHOT_LEGEND_ROW_PX - CHART_SCREENSHOT_CONTENT_GAP_PX;
}

/** Padding inside the modal preview pane. */
export const CHART_SCREENSHOT_PREVIEW_PANE_PADDING_PX = 24;

/** Grey gutter on left/right of the white export frame inside the preview pane. */
export const CHART_SCREENSHOT_PREVIEW_SIDE_GREY_PX = 64;

/** Modal preview zoom — display only; export stays 1200×675 at 2×. */
export const CHART_SCREENSHOT_PREVIEW_ZOOM_MIN_PERCENT = 0;
export const CHART_SCREENSHOT_PREVIEW_ZOOM_MAX_PERCENT = 200;
export const CHART_SCREENSHOT_PREVIEW_ZOOM_STEP_PERCENT = 10;
export const CHART_SCREENSHOT_PREVIEW_ZOOM_DEFAULT_PERCENT = 80;

export const CHART_SCREENSHOT_PREVIEW_ZOOM_OPTIONS = Array.from(
  { length: (CHART_SCREENSHOT_PREVIEW_ZOOM_MAX_PERCENT - CHART_SCREENSHOT_PREVIEW_ZOOM_MIN_PERCENT) / CHART_SCREENSHOT_PREVIEW_ZOOM_STEP_PERCENT + 1 },
  (_, i) => CHART_SCREENSHOT_PREVIEW_ZOOM_MIN_PERCENT + i * CHART_SCREENSHOT_PREVIEW_ZOOM_STEP_PERCENT,
);

export function clampChartScreenshotPreviewZoomPercent(percent: number): number {
  return Math.min(
    CHART_SCREENSHOT_PREVIEW_ZOOM_MAX_PERCENT,
    Math.max(CHART_SCREENSHOT_PREVIEW_ZOOM_MIN_PERCENT, percent),
  );
}

export function chartScreenshotPreviewDisplayScale(
  fitScale: number,
  zoomPercent: number,
): number {
  return fitScale * (clampChartScreenshotPreviewZoomPercent(zoomPercent) / 100);
}

export const CHART_SCREENSHOT_ASPECT_RATIO = CHART_SCREENSHOT_WIDTH_PX / CHART_SCREENSHOT_HEIGHT_PX;

export function chartScreenshotContentBoxSize(): { width: number; height: number } {
  const inset = 2 * CHART_SCREENSHOT_FRAME_PADDING_PX;
  return {
    width: CHART_SCREENSHOT_WIDTH_PX - inset,
    height: CHART_SCREENSHOT_HEIGHT_PX - inset,
  };
}

/**
 * Fit the 1200×675 export frame inside the preview pane content box.
 * `contentWidthPx` / `contentHeightPx` should exclude the pane's own padding.
 */
export function chartScreenshotPreviewScale(
  contentWidthPx: number,
  contentHeightPx: number,
): number {
  const availableWidth = Math.max(
    0,
    contentWidthPx - 2 * CHART_SCREENSHOT_PREVIEW_SIDE_GREY_PX,
  );
  const availableHeight = Math.max(
    0,
    contentHeightPx - 2 * CHART_SCREENSHOT_PREVIEW_SIDE_GREY_PX,
  );

  if (availableWidth <= 0) return 0.5;

  const scaleByWidth = availableWidth / CHART_SCREENSHOT_WIDTH_PX;
  if (availableHeight <= 0) return scaleByWidth;

  const scaleByHeight = availableHeight / CHART_SCREENSHOT_HEIGHT_PX;
  return Math.min(scaleByWidth, scaleByHeight);
}
