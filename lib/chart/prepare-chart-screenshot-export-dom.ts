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

  return () => {
    restoreClamp();
    restoreOverflow();
    restoreDots();
  };
}
