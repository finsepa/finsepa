import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  IPanePrimitive,
  IPanePrimitivePaneView,
  IPrimitivePaneRenderer,
  PaneAttachedParameter,
} from "lightweight-charts";

import { FUNDAMENTALS_BAR_TOP_RADIUS_PX } from "@/lib/chart/fundamentals-chart-surface";

export type FundamentalsRoundedBarItem = {
  centerX: number;
  top: number;
  bottom: number;
  color: string;
};

function drawBarTopRoundedRect(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  top: number,
  bottom: number,
  width: number,
  radius: number,
  color: string,
): void {
  const height = bottom - top;
  if (!Number.isFinite(height) || height <= 0 || width <= 0) return;

  const left = centerX - width / 2;
  const r = Math.min(radius, width / 2, height);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(left, bottom);
  ctx.lineTo(left, top + r);
  ctx.arcTo(left, top, left + r, top, r);
  ctx.lineTo(left + width - r, top);
  ctx.arcTo(left + width, top, left + width, top + r, r);
  ctx.lineTo(left + width, bottom);
  ctx.closePath();
  ctx.fill();
}

/** Canvas histogram bars with top corner radius (lightweight-charts uses square `fillRect`). */
export class FundamentalsRoundedBarsPrimitive implements IPanePrimitive {
  private _requestUpdate: (() => void) | null = null;
  private _items: FundamentalsRoundedBarItem[] = [];
  private _barWidthPx = 8;

  setBars(items: readonly FundamentalsRoundedBarItem[], barWidthPx: number): void {
    if (this._barWidthPx === barWidthPx && barsEqual(this._items, items)) return;
    this._items = items.slice();
    this._barWidthPx = barWidthPx;
    this._requestUpdate?.();
  }

  attached(param: PaneAttachedParameter): void {
    this._requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this._requestUpdate = null;
  }

  paneViews(): readonly IPanePrimitivePaneView[] {
    return [this._paneView];
  }

  private readonly _paneView: IPanePrimitivePaneView = {
    zOrder: () => "normal",
    renderer: () => this._renderer,
  };

  private readonly _renderer: IPrimitivePaneRenderer = {
    draw: (target: CanvasRenderingTarget2D) => {
      if (!this._items.length) return;
      const barWidthPx = this._barWidthPx;
      const radius = FUNDAMENTALS_BAR_TOP_RADIUS_PX;
      target.useMediaCoordinateSpace(({ context }) => {
        for (const item of this._items) {
          drawBarTopRoundedRect(
            context,
            item.centerX,
            item.top,
            item.bottom,
            barWidthPx,
            radius,
            item.color,
          );
        }
      });
    },
    drawBackground: () => {},
  };
}

function barsEqual(a: readonly FundamentalsRoundedBarItem[], b: readonly FundamentalsRoundedBarItem[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (
      x.centerX !== y.centerX ||
      x.top !== y.top ||
      x.bottom !== y.bottom ||
      x.color !== y.color
    ) {
      return false;
    }
  }
  return true;
}
