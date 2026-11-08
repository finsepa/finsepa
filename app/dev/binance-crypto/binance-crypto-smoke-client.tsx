"use client";

import { useEffect, useRef, useState } from "react";
import {
  AreaSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";

const BASES = ["BTC", "ETH", "SOL"] as const;
type Base = (typeof BASES)[number];

type Point = { time: UTCTimestamp; value: number };

function binanceSymbol(base: Base): string {
  return `${base}USDT`;
}

async function fetchSeed1m(base: Base): Promise<Point[]> {
  const symbol = binanceSymbol(base);
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&limit=120`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`klines ${res.status}`);
  const rows = (await res.json()) as unknown[];
  const out: Point[] = [];
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const openTimeMs = Number(row[0]);
    const close = Number(row[4]);
    if (!Number.isFinite(openTimeMs) || !Number.isFinite(close) || close <= 0) continue;
    out.push({ time: Math.floor(openTimeMs / 1000) as UTCTimestamp, value: close });
  }
  return out;
}

function formatPrice(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

export function BinanceCryptoSmokeClient() {
  const [base, setBase] = useState<Base>("BTC");
  const [status, setStatus] = useState<"connecting" | "live" | "error">("connecting");
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [tradeCount, setTradeCount] = useState(0);
  const [errorText, setErrorText] = useState<string | null>(null);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const pointsRef = useRef<Point[]>([]);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#a1a1aa",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      crosshair: { horzLine: { labelBackgroundColor: "#27272a" }, vertLine: { labelBackgroundColor: "#27272a" } },
    });
    const series = chart.addSeries(AreaSeries, {
      lineColor: "#22c55e",
      topColor: "rgba(34,197,94,0.28)",
      bottomColor: "rgba(34,197,94,0.02)",
      lineWidth: 2,
      priceLineVisible: true,
      lastValueVisible: true,
    });
    chartRef.current = chart;
    seriesRef.current = series;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let ws: WebSocket | null = null;
    const series = seriesRef.current;
    if (!series) return;

    setStatus("connecting");
    setErrorText(null);
    setTradeCount(0);
    setLastPrice(null);
    pointsRef.current = [];
    series.setData([]);

    (async () => {
      try {
        const seed = await fetchSeed1m(base);
        if (cancelled) return;
        pointsRef.current = seed;
        series.setData(seed);
        if (seed.length) {
          setLastPrice(seed[seed.length - 1]!.value);
          chartRef.current?.timeScale().fitContent();
        }
      } catch (err) {
        if (cancelled) return;
        setErrorText(err instanceof Error ? err.message : String(err));
      }

      const stream = `${base.toLowerCase()}usdt@trade`;
      const url = `wss://stream.binance.com:9443/ws/${stream}`;
      ws = new WebSocket(url);

      ws.onopen = () => {
        if (!cancelled) setStatus("live");
      };
      ws.onerror = () => {
        if (!cancelled) {
          setStatus("error");
          setErrorText("WebSocket error (Binance)");
        }
      };
      ws.onclose = () => {
        if (!cancelled) setStatus((s) => (s === "error" ? s : "connecting"));
      };
      ws.onmessage = (ev) => {
        if (cancelled) return;
        let msg: { e?: string; p?: string; T?: number; E?: number };
        try {
          msg = JSON.parse(String(ev.data)) as typeof msg;
        } catch {
          return;
        }
        if (msg.e !== "trade") return;
        const price = Number(msg.p);
        const tradeMs = Number(msg.T ?? msg.E ?? Date.now());
        if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(tradeMs)) return;

        const bucket = (Math.floor(tradeMs / 60_000) * 60) as UTCTimestamp;
        const pts = pointsRef.current;
        const last = pts[pts.length - 1];
        if (last && last.time === bucket) {
          last.value = price;
          series.update(last);
        } else if (!last || bucket > last.time) {
          const next = { time: bucket, value: price };
          pts.push(next);
          series.update(next);
        } else {
          return;
        }

        setLastPrice(price);
        setTradeCount((n) => n + 1);
      };
    })();

    return () => {
      cancelled = true;
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
    };
    // intentionally re-run on base change only; chart series is stable after mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-4 px-4 py-8 text-zinc-100">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Dev only · not production</p>
        <h1 className="text-2xl font-semibold tracking-tight">Binance WS smoke test</h1>
        <p className="text-sm text-zinc-400">
          Browser → Binance public trades (USDT). Live EODHD crypto worker and Supabase minute bars are untouched.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {BASES.map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => setBase(b)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              base === b ? "bg-zinc-100 text-zinc-900" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
          >
            {b}
          </button>
        ))}
        <span
          className={`ml-auto rounded-full px-2.5 py-1 text-xs font-medium ${
            status === "live"
              ? "bg-emerald-500/15 text-emerald-400"
              : status === "error"
                ? "bg-red-500/15 text-red-400"
                : "bg-zinc-700 text-zinc-300"
          }`}
        >
          {status}
        </span>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-sm text-zinc-500">{base}/USDT</p>
            <p className="text-3xl font-semibold tabular-nums tracking-tight">{formatPrice(lastPrice ?? NaN)}</p>
          </div>
          <p className="text-sm text-zinc-500">
            trades this session: <span className="tabular-nums text-zinc-300">{tradeCount}</span>
          </p>
        </div>
        <div ref={hostRef} className="h-[420px] w-full" />
        {errorText ? <p className="mt-2 text-sm text-red-400">{errorText}</p> : null}
      </div>
    </div>
  );
}
