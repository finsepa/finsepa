/**
 * TEMP evidence-only tracer for post-fetch PriceChart pipeline.
 * Enable: window.__chartPipelineTraceEnable()
 * Read: window.__chartPipelineTraceDump()
 * Disable: window.__chartPipelineTraceDisable()
 */
export type ChartPipelineStage = {
  name: string;
  start: number;
  end: number;
  durationMs: number;
  detail?: Record<string, unknown>;
};

export type ChartPipelineCounters = {
  setData: number;
  update: number;
  applyOptions: number;
  fitContent: number;
  autoscale: number;
  timeScaleMutations: number;
  visibleRangeChanges: number;
  seriesRecreation: number;
  chartRecreation: number;
};

export type ChartPipelineRun = {
  id: string;
  label: string;
  kind: string;
  symbol: string;
  range: string;
  startedAt: number;
  stages: ChartPipelineStage[];
  counters: ChartPipelineCounters;
  completed: boolean;
};

type TraceHost = {
  enabled: boolean;
  run: ChartPipelineRun | null;
  runs: ChartPipelineRun[];
};

function host(): TraceHost {
  const g = globalThis as typeof globalThis & { __chartPipelineTraceHost?: TraceHost };
  if (!g.__chartPipelineTraceHost) {
    g.__chartPipelineTraceHost = { enabled: false, run: null, runs: [] };
  }
  return g.__chartPipelineTraceHost;
}

function now() {
  return performance.now();
}

function emptyCounters(): ChartPipelineCounters {
  return {
    setData: 0,
    update: 0,
    applyOptions: 0,
    fitContent: 0,
    autoscale: 0,
    timeScaleMutations: 0,
    visibleRangeChanges: 0,
    seriesRecreation: 0,
    chartRecreation: 0,
  };
}

export function chartPipelineTraceEnabled(): boolean {
  return host().enabled;
}

export function chartPipelineBeginRun(meta: {
  label: string;
  kind: string;
  symbol: string;
  range: string;
}): string | null {
  const h = host();
  if (!h.enabled) return null;
  const id = `${meta.symbol}-${meta.range}-${Math.round(now())}`;
  h.run = {
    id,
    label: meta.label,
    kind: meta.kind,
    symbol: meta.symbol,
    range: meta.range,
    startedAt: now(),
    stages: [],
    counters: emptyCounters(),
    completed: false,
  };
  return id;
}

export function chartPipelineMark(
  name: string,
  detail?: Record<string, unknown>,
): { end: () => void } {
  const h = host();
  const run = h.run;
  if (!h.enabled || !run) {
    return { end: () => undefined };
  }
  const start = now();
  return {
    end: () => {
      const end = now();
      run.stages.push({
        name,
        start,
        end,
        durationMs: end - start,
        detail,
      });
    },
  };
}

/** Instant zero-width mark (event timestamp). */
export function chartPipelineInstant(name: string, detail?: Record<string, unknown>): void {
  const h = host();
  const run = h.run;
  if (!h.enabled || !run) return;
  const t = now();
  run.stages.push({ name, start: t, end: t, durationMs: 0, detail });
}

export function chartPipelineCount(key: keyof ChartPipelineCounters, n = 1): void {
  const run = host().run;
  if (!run) return;
  run.counters[key] += n;
}

export function chartPipelineComplete(extra?: Record<string, unknown>): void {
  const h = host();
  const run = h.run;
  if (!run) return;
  // Wait until fetch path has handed points to React — ignore pre-fetch chart effect churn.
  const setPointsIdx = run.stages.findIndex((s) => s.name === "setPoints_called");
  if (setPointsIdx < 0) return;
  // Prefer completing after data_received so body/parse are in the record.
  if (!run.stages.some((s) => s.name === "data_received")) return;
  // Must have applied series data AFTER setPoints (ignore stale rAF from pre-fetch effect).
  if (!run.stages.slice(setPointsIdx).some((s) => s.name === "series.setData")) return;
  if (extra) chartPipelineInstant("complete", extra);
  run.completed = true;
  h.runs.push(run);
  h.run = null;
}

export function chartPipelineActiveRun(): ChartPipelineRun | null {
  return host().run;
}

/** Wrap chart + timeScale methods for counters (idempotent per object). */
export function installChartPipelineSpies(chart: {
  timeScale: () => Record<string, unknown>;
  applyOptions?: (...args: unknown[]) => unknown;
}): void {
  if (!chartPipelineTraceEnabled()) return;
  const c = chart as Record<string, unknown> & {
    __pipelineSpied?: boolean;
    applyOptions?: (...args: unknown[]) => unknown;
    timeScale: () => Record<string, unknown>;
  };
  if (c.__pipelineSpied) return;
  c.__pipelineSpied = true;
  chartPipelineCount("chartRecreation", 1);

  if (typeof c.applyOptions === "function") {
    const orig = c.applyOptions.bind(c);
    c.applyOptions = (...args: unknown[]) => {
      chartPipelineCount("applyOptions");
      return orig(...args);
    };
  }

  const ts = c.timeScale();
  if ((ts as { __pipelineSpied?: boolean }).__pipelineSpied) return;
  (ts as { __pipelineSpied?: boolean }).__pipelineSpied = true;

  for (const method of [
    "fitContent",
    "setVisibleLogicalRange",
    "setVisibleRange",
    "applyOptions",
    "scrollToPosition",
    "scrollToRealTime",
    "resetTimeScale",
  ] as const) {
    const fn = ts[method];
    if (typeof fn !== "function") continue;
    const orig = (fn as (...a: unknown[]) => unknown).bind(ts);
    ts[method] = (...args: unknown[]) => {
      if (method === "fitContent") chartPipelineCount("fitContent");
      else if (method === "applyOptions") {
        chartPipelineCount("applyOptions");
        chartPipelineCount("timeScaleMutations");
      } else if (method === "setVisibleLogicalRange" || method === "setVisibleRange") {
        chartPipelineCount("visibleRangeChanges");
        chartPipelineCount("timeScaleMutations");
      } else {
        chartPipelineCount("timeScaleMutations");
      }
      // Count only — do not nest performance marks (avoids re-entrancy with chart internals).
      return orig(...args);
    };
  }
}

/** Wrap a series API for setData/update/applyOptions counters. */
export function installSeriesPipelineSpies(series: Record<string, unknown> | null | undefined): void {
  if (!series || !chartPipelineTraceEnabled()) return;
  if ((series as { __pipelineSpied?: boolean }).__pipelineSpied) return;
  (series as { __pipelineSpied?: boolean }).__pipelineSpied = true;
  chartPipelineCount("seriesRecreation", 1);

  for (const method of ["setData", "update", "applyOptions"] as const) {
    const fn = series[method];
    if (typeof fn !== "function") continue;
    const orig = (fn as (...a: unknown[]) => unknown).bind(series);
    series[method] = (...args: unknown[]) => {
      if (method === "setData") chartPipelineCount("setData");
      else if (method === "update") chartPipelineCount("update");
      else chartPipelineCount("applyOptions");
      if (method === "setData") {
        const detail = Array.isArray(args[0]) ? { points: (args[0] as unknown[]).length } : undefined;
        const mark = chartPipelineMark("series.setData", detail);
        try {
          return orig(...args);
        } finally {
          mark.end();
        }
      }
      return orig(...args);
    };
  }
}

export function installChartPipelineGlobals(): void {
  const g = globalThis as typeof globalThis & {
    __chartPipelineTraceEnable?: () => void;
    __chartPipelineTraceDisable?: () => void;
    __chartPipelineTraceDump?: () => ChartPipelineRun[];
    __chartPipelineTraceClear?: () => void;
    __chartPipelineTraceActive?: () => ChartPipelineRun | null;
  };
  g.__chartPipelineTraceEnable = () => {
    host().enabled = true;
  };
  g.__chartPipelineTraceDisable = () => {
    host().enabled = false;
  };
  g.__chartPipelineTraceDump = () => [...host().runs];
  g.__chartPipelineTraceClear = () => {
    host().runs = [];
    host().run = null;
  };
  g.__chartPipelineTraceActive = () => host().run;
}
