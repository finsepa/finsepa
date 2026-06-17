import { toJpeg } from "html-to-image";
import {
  CHART_SCREENSHOT_EXPORT_PIXEL_RATIO,
  CHART_SCREENSHOT_HEIGHT_PX,
  CHART_SCREENSHOT_WIDTH_PX,
} from "@/lib/chart/chart-screenshot-constants";

function waitForAnimationFrames(count: number): Promise<void> {
  return new Promise((resolve) => {
    let remaining = count;
    const step = () => {
      remaining -= 1;
      if (remaining <= 0) {
        resolve();
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

/** CSS transforms break canvas capture in html-to-image's SVG foreignObject path. */
function temporarilyClearTransforms(root: HTMLElement): () => void {
  const nodes = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
  const snapshots: Array<{ node: HTMLElement; transform: string }> = [];

  for (const node of nodes) {
    const computed = window.getComputedStyle(node).transform;
    if (computed === "none") continue;
    snapshots.push({ node, transform: node.style.transform });
    node.style.transform = "none";
  }

  return () => {
    for (const { node, transform } of snapshots) {
      node.style.transform = transform;
    }
  };
}

export async function exportChartScreenshotJpeg(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  const prevTransform = element.style.transform;
  element.style.transform = "none";
  const restoreTransforms = temporarilyClearTransforms(element);

  try {
    await waitForAnimationFrames(2);

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
    restoreTransforms();
    element.style.transform = prevTransform;
  }
}

export function chartScreenshotExportFilename(ticker: string, metricSlug?: string): string {
  const sym = ticker.trim().toUpperCase() || "chart";
  const stamp = new Date().toISOString().slice(0, 10);
  const slug = metricSlug?.trim().replace(/_/g, "-").toLowerCase();
  return slug ? `${sym}-${slug}-${stamp}.jpg` : `${sym}-chart-${stamp}.jpg`;
}
