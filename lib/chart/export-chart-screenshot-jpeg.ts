import { toJpeg } from "html-to-image";
import {
  CHART_SCREENSHOT_EXPORT_PIXEL_RATIO,
  CHART_SCREENSHOT_HEIGHT_PX,
  CHART_SCREENSHOT_WIDTH_PX,
} from "@/lib/chart/chart-screenshot-constants";

const EXPORT_CANVAS_SWAP_ATTR = "data-chart-export-canvas-swap";

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

function transformScaleFactors(transform: string): { x: number; y: number } | null {
  if (!transform || transform === "none") return null;

  const matrixMatch = transform.match(/^matrix\(([^)]+)\)$/);
  if (matrixMatch) {
    const parts = matrixMatch[1]!.split(",").map((s) => Number.parseFloat(s.trim()));
    if (parts.length >= 4) {
      const [a, b, c, d] = parts;
      return { x: Math.hypot(a!, b!), y: Math.hypot(c!, d!) };
    }
  }

  const matrix3dMatch = transform.match(/^matrix3d\(([^)]+)\)$/);
  if (matrix3dMatch) {
    const parts = matrix3dMatch[1]!.split(",").map((s) => Number.parseFloat(s.trim()));
    if (parts.length >= 16) {
      return {
        x: Math.hypot(parts[0]!, parts[1]!, parts[2]!),
        y: Math.hypot(parts[4]!, parts[5]!, parts[6]!),
      };
    }
  }

  if (/scale[XY(]/.test(transform)) {
    return { x: 2, y: 2 };
  }

  return null;
}

function transformHasNonUnityScale(transform: string): boolean {
  const scale = transformScaleFactors(transform);
  if (!scale) return false;
  return Math.abs(scale.x - 1) > 0.001 || Math.abs(scale.y - 1) > 0.001;
}

/**
 * Scale transforms break html-to-image's foreignObject capture, but translate
 * transforms are required for bar centering and value-label positioning.
 */
function temporarilyNeutralizeScaleTransforms(root: HTMLElement): () => void {
  const nodes: HTMLElement[] = [];
  let parent: HTMLElement | null = root.parentElement;
  while (parent) {
    nodes.push(parent);
    parent = parent.parentElement;
  }
  nodes.push(root, ...Array.from(root.querySelectorAll<HTMLElement>("*")));

  const snapshots: Array<{ node: HTMLElement; transform: string }> = [];

  for (const node of nodes) {
    const computed = window.getComputedStyle(node).transform;
    if (!transformHasNonUnityScale(computed)) continue;
    snapshots.push({ node, transform: node.style.transform });
    node.style.transform = "none";
  }

  return () => {
    for (const { node, transform } of snapshots) {
      node.style.transform = transform;
    }
  };
}

/** Lightweight Charts canvases often export blank — swap to <img> snapshots first. */
function temporarilySwapCanvasesForImages(root: HTMLElement): () => void {
  const restores: Array<() => void> = [];

  for (const canvas of root.querySelectorAll("canvas")) {
    if (!(canvas instanceof HTMLCanvasElement)) continue;
    if (canvas.width <= 0 || canvas.height <= 0) continue;

    let dataUrl: string;
    try {
      dataUrl = canvas.toDataURL("image/png");
    } catch {
      continue;
    }
    if (dataUrl === "data:,") continue;

    const img = document.createElement("img");
    img.setAttribute(EXPORT_CANVAS_SWAP_ATTR, "");
    img.src = dataUrl;
    img.alt = "";
    img.className = canvas.className;
    img.style.cssText = window.getComputedStyle(canvas).cssText;

    const parent = canvas.parentElement;
    if (!parent) continue;

    const prevVisibility = canvas.style.visibility;
    canvas.style.visibility = "hidden";
    parent.insertBefore(img, canvas.nextSibling);
    restores.push(() => {
      img.remove();
      canvas.style.visibility = prevVisibility;
    });
  }

  return () => {
    for (let i = restores.length - 1; i >= 0; i -= 1) {
      restores[i]!();
    }
  };
}

async function waitForSwappedCanvasImages(root: HTMLElement): Promise<void> {
  const imgs = root.querySelectorAll<HTMLImageElement>(`img[${EXPORT_CANVAS_SWAP_ATTR}]`);
  await Promise.all(
    [...imgs].map((img) => (img.decode ? img.decode().catch(() => undefined) : Promise.resolve())),
  );
  await waitForAnimationFrames(2);
}

export async function exportChartScreenshotJpeg(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  const restoreScale = temporarilyNeutralizeScaleTransforms(element);
  const restoreCanvases = temporarilySwapCanvasesForImages(element);

  try {
    await waitForAnimationFrames(3);
    await waitForSwappedCanvasImages(element);

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
    restoreCanvases();
    restoreScale();
  }
}

export function chartScreenshotExportFilename(ticker: string, metricSlug?: string): string {
  const sym = ticker.trim().toUpperCase() || "chart";
  const stamp = new Date().toISOString().slice(0, 10);
  const slug = metricSlug?.trim().replace(/_/g, "-").toLowerCase();
  return slug ? `${sym}-${slug}-${stamp}.jpg` : `${sym}-chart-${stamp}.jpg`;
}
