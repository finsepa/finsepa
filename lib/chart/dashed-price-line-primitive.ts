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
 * Dashed horizontal line at a price with a custom dash pattern (LWC price lines only offer fixed
 * patterns), in the bottom layer so the series line and hover marker paint above it.
 */
export class DashedPriceLinePrimitive implements ISeriesPrimitive<Time> {
  private _series: ISeriesApi<SeriesType, Time> | null = null;
  private _requestUpdate: (() => void) | null = null;
  private _price: number | null = null;
  private _color = "transparent";
  private _dashPx = 5.5;

  setLine(price: number | null, color: string, dashPx: number): void {
    if (price === this._price && color === this._color && dashPx === this._dashPx) return;
    this._price = price;
    this._color = color;
    this._dashPx = dashPx;
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
      if (!series || this._price == null) return;
      const y = series.priceToCoordinate(this._price);
      if (y == null || !Number.isFinite(y)) return;
      target.useBitmapCoordinateSpace(({ context, bitmapSize, horizontalPixelRatio, verticalPixelRatio }) => {
        const lineWidth = Math.max(1, Math.floor(verticalPixelRatio));
        const yPx = Math.round(y * verticalPixelRatio) + (lineWidth % 2 ? 0.5 : 0);
        const dash = this._dashPx * horizontalPixelRatio;
        context.save();
        context.strokeStyle = this._color;
        context.lineWidth = lineWidth;
        context.setLineDash([dash, dash]);
        context.beginPath();
        context.moveTo(0, yPx);
        context.lineTo(bitmapSize.width, yPx);
        context.stroke();
        context.restore();
      });
    },
  };
}

const linesBySeries = new WeakMap<object, DashedPriceLinePrimitive>();

/** One dashed baseline primitive per series, attached on first use. */
export function dashedPriceLineFor(series: ISeriesApi<SeriesType, Time>): DashedPriceLinePrimitive {
  let primitive = linesBySeries.get(series);
  if (!primitive) {
    primitive = new DashedPriceLinePrimitive();
    series.attachPrimitive(primitive);
    linesBySeries.set(series, primitive);
  }
  return primitive;
}

export function clearDashedPriceLine(series: ISeriesApi<SeriesType, Time>): void {
  linesBySeries.get(series)?.setLine(null, "transparent", 0);
}
