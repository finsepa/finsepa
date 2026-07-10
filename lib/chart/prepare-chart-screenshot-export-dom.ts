import { CHART_PLOT_DOTS_PATTERN_EXPORT_CLASS } from "@/components/chart/overview-bottom-axis";

const EXPORT_PREP_DOTS_SWAP_ATTR = "data-chart-export-dots-swapped";

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

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function hasMaskImage(el: Element): boolean {
  const style = window.getComputedStyle(el);
  const mask = style.maskImage || style.webkitMaskImage;
  return Boolean(mask && mask !== "none");
}

/** Masked dot grids break html-to-image — swap to an overlay-based export variant. */
function temporarilyReplaceMaskedDotPatterns(root: HTMLElement): () => void {
  const restores: Array<{ el: HTMLElement; className: string }> = [];

  for (const el of root.querySelectorAll<HTMLElement>("*")) {
    const usesPlotDots =
      el.className.includes("background-size:8px_8px") ||
      (hasMaskImage(el) &&
        window.getComputedStyle(el).backgroundImage.includes("radial-gradient"));
    if (!usesPlotDots) continue;

    restores.push({ el, className: el.className });
    el.setAttribute(EXPORT_PREP_DOTS_SWAP_ATTR, "");
    el.className = CHART_PLOT_DOTS_PATTERN_EXPORT_CLASS;
    el.style.visibility = "";
  }

  return () => {
    for (const { el, className } of restores) {
      el.removeAttribute(EXPORT_PREP_DOTS_SWAP_ATTR);
      el.className = className;
    }
  };
}

function temporarilyAllowOverflow(root: HTMLElement): () => void {
  const nodes: HTMLElement[] = [];
  let parent: HTMLElement | null = root;
  while (parent) {
    nodes.push(parent);
    parent = parent.parentElement;
  }

  const snapshots: Array<{ node: HTMLElement; overflow: string }> = [];
  for (const node of nodes) {
    const overflow = window.getComputedStyle(node).overflow;
    if (overflow === "visible") continue;
    snapshots.push({ node, overflow: node.style.overflow });
    node.style.overflow = "visible";
  }

  return () => {
    for (const { node, overflow } of snapshots) {
      node.style.overflow = overflow;
    }
  };
}

/**
 * `clamp()` in inline styles often resolves incorrectly inside html-to-image's SVG
 * foreignObject — flatten to pixel positions from the live layout.
 */
function temporarilyFlattenClampPositions(root: HTMLElement): () => void {
  const restores: Array<{ el: HTMLElement; style: string }> = [];

  for (const el of root.querySelectorAll<HTMLElement>("*")) {
    const inlineLeft = el.style.left;
    if (!inlineLeft.includes("clamp(")) continue;

    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 && rect.height <= 0) continue;

    const offsetParent = el.offsetParent as HTMLElement | null;
    if (!offsetParent) continue;

    const parentRect = offsetParent.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2 - parentRect.left;

    restores.push({ el, style: el.getAttribute("style") ?? "" });
    el.style.left = `${Math.round(centerX)}px`;
    el.style.transform = "translateX(-50%)";
    el.style.right = "auto";
  }

  return () => {
    for (const { el, style } of restores) {
      if (style) el.setAttribute("style", style);
      else el.removeAttribute("style");
    }
  };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function waitForImageElement(img: HTMLImageElement): Promise<void> {
  if (img.complete && img.naturalWidth > 0) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => resolve();
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", done, { once: true });
  });
}

async function fetchSameOriginImageDataUrl(src: string): Promise<string | null> {
  if (src.startsWith("data:")) return null;
  let absolute: string;
  try {
    absolute = new URL(src, window.location.origin).href;
  } catch {
    return null;
  }
  if (!absolute.startsWith(window.location.origin)) return null;
  try {
    const res = await fetch(absolute, { credentials: "same-origin" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return null;
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

/**
 * html-to-image often captures blank logos (lazy load + cross-origin redirects).
 * Inline same-origin images as data URLs before JPEG export.
 */
async function temporarilyInlineExportImages(root: HTMLElement): Promise<() => void> {
  const restores: Array<{ img: HTMLImageElement; src: string; loading: string }> = [];
  const imgs = [...root.querySelectorAll("img")].filter(
    (node): node is HTMLImageElement => node instanceof HTMLImageElement,
  );

  await Promise.all(
    imgs.map(async (img) => {
      const prevLoading = img.loading;
      img.loading = "eager";

      await waitForImageElement(img);

      const fetchSrc = img.currentSrc || img.src;
      let dataUrl = await fetchSameOriginImageDataUrl(fetchSrc);

      if (!dataUrl && img.naturalWidth > 0) {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            dataUrl = canvas.toDataURL("image/png");
          }
        } catch {
          // Tainted canvas — keep original src.
        }
      }

      if (dataUrl) {
        restores.push({ img, src: img.src, loading: prevLoading });
        img.src = dataUrl;
      } else {
        img.loading = prevLoading;
      }
    }),
  );

  await waitForAnimationFrames(1);

  return () => {
    for (const { img, src, loading } of restores) {
      img.src = src;
      img.loading = loading as HTMLImageElement["loading"];
    }
  };
}

/** Lightweight Charts resize handlers are debounced — flush before capture. */
async function flushChartLayout(root: HTMLElement): Promise<void> {
  window.dispatchEvent(new Event("resize"));
  await waitForAnimationFrames(4);
  await waitMs(160);
  void root.offsetHeight;
}

/**
 * Prepare live DOM for html-to-image capture so HTML overlays (axis labels, badges)
 * match the on-screen download preview.
 */
export async function prepareChartScreenshotExportDom(root: HTMLElement): Promise<() => void> {
  const restoreDots = temporarilyReplaceMaskedDotPatterns(root);
  const restoreOverflow = temporarilyAllowOverflow(root);

  await flushChartLayout(root);

  const restoreClamp = temporarilyFlattenClampPositions(root);
  await waitForAnimationFrames(2);
  const restoreImages = await temporarilyInlineExportImages(root);

  return () => {
    restoreImages();
    restoreClamp();
    restoreOverflow();
    restoreDots();
  };
}
