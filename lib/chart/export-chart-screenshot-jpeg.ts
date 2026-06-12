import { toJpeg } from "html-to-image";
import {
  CHART_SCREENSHOT_EXPORT_PIXEL_RATIO,
  CHART_SCREENSHOT_HEIGHT_PX,
  CHART_SCREENSHOT_WIDTH_PX,
} from "@/lib/chart/chart-screenshot-constants";

export async function exportChartScreenshotJpeg(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  const prevTransform = element.style.transform;
  element.style.transform = "none";

  try {
    const dataUrl = await toJpeg(element, {
      width: CHART_SCREENSHOT_WIDTH_PX,
      height: CHART_SCREENSHOT_HEIGHT_PX,
      pixelRatio: CHART_SCREENSHOT_EXPORT_PIXEL_RATIO,
      quality: 0.92,
      backgroundColor: "#ffffff",
      cacheBust: true,
    });

    const link = document.createElement("a");
    link.download = filename.endsWith(".jpg") ? filename : `${filename}.jpg`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    element.style.transform = prevTransform;
  }
}

export function chartScreenshotExportFilename(ticker: string): string {
  const sym = ticker.trim().toUpperCase() || "chart";
  const stamp = new Date().toISOString().slice(0, 10);
  return `${sym}-chart-${stamp}.jpg`;
}
