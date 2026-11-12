import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  SeriesType,
  Time,
} from "lightweight-charts";

/**
 * Horizontal gridlines at given prices, drawn in the pane's bottom layer so the series line, its
 * area fill, dashed baseline and hover marker all paint above them (price lines always paint on top).
 */
export class PriceGridlinesPrimitive implements ISeriesPrimitive<Time> {
  private _series: ISeriesApi<SeriesType, Time> | null = null;
  private _requestUpdate: (() => void) | null = null;
  private _prices: number[] = [];
  private _color = "transparent";

  setPrices(prices: readonly number[], color: string): void {
    if (
      color === this._color &&
      prices.length === this._prices.length &&
      prices.every((p, i) => p === this._prices[i])
    ) {
      return;
    }
    this._prices = prices.slice();
    this._color = color;
    this._requestUpdate?.();
  }

  attached(param: SeriesAttachedParameter<Time>): void {
    this._series = param.series;
    this._requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this._series = null;
    this._requestUpdate = null;
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this._paneView];
  }

  private readonly _paneView: IPrimitivePaneView = {
    zOrder: () => "bottom",
    renderer: () => this._renderer,
  };

  private readonly _renderer: IPrimitivePaneRenderer = {
    draw: (target: CanvasRenderingTarget2D) => {
      const series = this._series;
      if (!series || this._prices.length === 0) return;
      target.useBitmapCoordinateSpace(({ context, bitmapSize, verticalPixelRatio }) => {
        const lineHeight = Math.max(1, Math.floor(verticalPixelRatio));
        context.fillStyle = this._color;
        for (const price of this._prices) {
          const y = series.priceToCoordinate(price);
          if (y == null || !Number.isFinite(y)) continue;
          const top = Math.round(y * verticalPixelRatio) - Math.floor(lineHeight / 2);
          if (top < 0 || top >= bitmapSize.height) continue;
          context.fillRect(0, top, bitmapSize.width, lineHeight);
        }
      });
    },
  };
}

const gridlinesBySeries = new WeakMap<object, PriceGridlinesPrimitive>();

export function clearPriceGridlines(series: ISeriesApi<SeriesType, Time>): void {
  gridlinesBySeries.get(series)?.setPrices([], "transparent");
}

/** One gridlines primitive per series, attached on first use. */
export function priceGridlinesFor(series: ISeriesApi<SeriesType, Time>): PriceGridlinesPrimitive {
  let primitive = gridlinesBySeries.get(series);
  if (!primitive) {
    primitive = new PriceGridlinesPrimitive();
    series.attachPrimitive(primitive);
    gridlinesBySeries.set(series, primitive);
  }
  return primitive;
}
