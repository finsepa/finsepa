"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

import type { EodhdTraceBudgetResponse, EodhdTraceProbeResponse } from "@/lib/admin-health/eodhd-trace-types";

type Props = {
  slug: string;
};

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatFnBreakdown(byFn: Record<string, number>): string {
  const entries = Object.entries(byFn).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return "—";
  return entries.map(([fn, n]) => `${fn}×${n}`).join(", ");
}

function budgetTone(used: number, max: number | null): string {
  if (max == null || max <= 0) return "text-fg-muted";
  const ratio = used / max;
  if (ratio >= 0.9) return "text-red-600";
  if (ratio >= 0.7) return "text-amber-700";
  return "text-emerald-700";
}

export function OpsEodhdTracePanel({ slug }: Props) {
  const [budget, setBudget] = useState<EodhdTraceBudgetResponse | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(true);
  const [budgetError, setBudgetError] = useState<string | null>(null);

  const [ticker, setTicker] = useState("AAPL");
  const [runIngest, setRunIngest] = useState(false);
  const [probe, setProbe] = useState<EodhdTraceProbeResponse | null>(null);
  const [probeLoading, setProbeLoading] = useState(false);
  const [probeError, setProbeError] = useState<string | null>(null);

  const loadBudget = useCallback(async () => {
    setBudgetLoading(true);
    setBudgetError(null);
    try {
      const res = await fetch(
        `/api/ops/${encodeURIComponent(slug)}/eodhd-trace?mode=budget`,
        { credentials: "same-origin" },
      );
      if (!res.ok) throw new Error("Could not load EODHD budget.");
      setBudget((await res.json()) as EodhdTraceBudgetResponse);
    } catch (e) {
      setBudgetError(e instanceof Error ? e.message : "Budget load failed.");
    } finally {
      setBudgetLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadBudget();
  }, [loadBudget]);

  async function runProbe() {
    setProbeLoading(true);
    setProbeError(null);
    try {
      const params = new URLSearchParams({ mode: "probe", ticker: ticker.trim().toUpperCase() || "AAPL" });
      if (runIngest) params.set("ingest", "1");
      const res = await fetch(
        `/api/ops/${encodeURIComponent(slug)}/eodhd-trace?${params.toString()}`,
        { credentials: "same-origin" },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Probe failed.");
      }
      setProbe((await res.json()) as EodhdTraceProbeResponse);
      await loadBudget();
    } catch (e) {
      setProbeError(e instanceof Error ? e.message : "Probe failed.");
    } finally {
      setProbeLoading(false);
    }
  }

  const coldWarm = useMemo(() => {
    if (!probe) return null;
    const sym = ticker.trim().toUpperCase() || "AAPL";
    const cold = probe.probes.find((p) => p.label === `asset/${sym}-cold`);
    const warm = probe.probes.find((p) => p.label === `asset/${sym}-warm`);
    return { cold, warm, sym };
  }, [probe, ticker]);

  const probeTotal = useMemo(
    () => (probe ? probe.probes.reduce((sum, p) => sum + p.eodhdHttp, 0) : 0),
    [probe],
  );

  return (
    <section className="mt-10 border-t border-stroke pt-10">
      <header className="mb-4">
        <h2 className="text-lg font-semibold text-fg">EODHD trace (validation gate)</h2>
        <p className="mt-1 text-sm text-fg-muted">
          Read-only instrumentation — counts outbound EODHD HTTP per server scope. Use after P0 cache
          changes to confirm cold vs warm stock loads and budget headroom. Does not change live prices or
          WebSocket behavior.
        </p>
      </header>

      <article className="rounded-xl border border-stroke bg-surface p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-fg">Rolling budget (this isolate)</h3>
            <p className="mt-1 text-xs text-fg-muted">
              Per Node / serverless instance — not global across all Vercel regions.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadBudget()}
            disabled={budgetLoading}
            className="rounded-lg border border-stroke bg-surface px-3 py-1.5 text-xs font-medium text-fg-muted transition hover:bg-surface-muted disabled:opacity-60"
          >
            Refresh budget
          </button>
        </div>

        {budgetLoading && !budget ? (
          <div className="mt-4 flex justify-center py-6">
            <Spinner className="size-5 text-[#71717A]" />
          </div>
        ) : budgetError ? (
          <p className="mt-3 text-sm text-red-600">{budgetError}</p>
        ) : budget ? (
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div className="rounded-lg bg-surface-muted px-3 py-2">
              <dt className="text-xs text-fg-muted">Last hour</dt>
              <dd
                className={cn(
                  "mt-0.5 font-mono text-base font-semibold",
                  budgetTone(budget.budget.usedHour, budget.budget.maxPerHour),
                )}
              >
                {budget.budget.usedHour} / {budget.budget.maxPerHour}
              </dd>
            </div>
            <div className="rounded-lg bg-surface-muted px-3 py-2">
              <dt className="text-xs text-fg-muted">Last 24h (if capped)</dt>
              <dd
                className={cn(
                  "mt-0.5 font-mono text-base font-semibold",
                  budgetTone(budget.budget.usedDay, budget.budget.maxPerDay),
                )}
              >
                {budget.budget.maxPerDay != null
                  ? `${budget.budget.usedDay} / ${budget.budget.maxPerDay}`
                  : `${budget.budget.usedDay} (no daily cap)`}
              </dd>
            </div>
            <div className="sm:col-span-2 text-xs text-fg-muted">
              Snapshot {formatWhen(budget.at)}
              {budget.providerTraceEnabled ? " · FINSEPA_PROVIDER_TRACE=1 (console logs on)" : null}
            </div>
          </dl>
        ) : null}
      </article>

      <article className="mt-4 rounded-xl border border-stroke bg-surface p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-fg">Validation probe</h3>
        <p className="mt-1 text-xs text-fg-muted">
          Runs representative scopes (screener snapshot reads, cold + warm stock page). Cold load hits
          EODHD — run sparingly on production.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-xs font-medium text-fg-muted">Ticker</span>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              className="mt-1 block w-28 rounded-lg border border-stroke bg-surface px-3 py-2 font-mono text-sm text-fg"
              placeholder="AAPL"
            />
          </label>
          <label className="flex items-center gap-2 pb-2 text-xs text-fg-muted">
            <input
              type="checkbox"
              checked={runIngest}
              onChange={(e) => setRunIngest(e.target.checked)}
              className="rounded border-stroke"
            />
            Include cron ingest (expensive)
          </label>
          <button
            type="button"
            onClick={() => void runProbe()}
            disabled={probeLoading}
            className="rounded-lg bg-fg px-4 py-2 text-sm font-medium text-surface transition hover:bg-fg disabled:opacity-60"
          >
            {probeLoading ? (
              <span className="inline-flex items-center gap-2">
                <Spinner data-icon="inline-start" className="size-4" />
                Running probe…
              </span>
            ) : (
              "Run validation probe"
            )}
          </button>
        </div>

        {probeError ? <p className="mt-3 text-sm text-red-600">{probeError}</p> : null}

        {probe ? (
          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap gap-4 text-xs text-fg-muted">
              <span>Probe at {formatWhen(probe.at)}</span>
              <span>Segment {probe.segment}</span>
              <span>Market {probe.marketMode}</span>
              <span className="font-mono">Session total {probeTotal} EODHD HTTP</span>
            </div>

            {coldWarm?.cold || coldWarm?.warm ? (
              <div className="rounded-lg border border-stroke bg-surface-muted px-3 py-2 text-sm">
                <p className="font-medium text-fg">Stock page gate ({coldWarm.sym})</p>
                <p className="mt-1 text-fg-muted">
                  Cold{" "}
                  <span className="font-mono text-fg">{coldWarm.cold?.eodhdHttp ?? "—"}</span> · Warm{" "}
                  <span className="font-mono text-fg">{coldWarm.warm?.eodhdHttp ?? "—"}</span> EODHD
                  calls. After P0-1/P0-2, cold should show fewer duplicate{" "}
                  <code className="text-xs">fetchEodhdEodDaily</code> entries in{" "}
                  <code className="text-xs">byFn</code>.
                </p>
              </div>
            ) : null}

            <div className="overflow-x-auto rounded-lg border border-stroke">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-surface-muted text-fg-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Scope</th>
                    <th className="px-3 py-2 font-medium">EODHD HTTP</th>
                    <th className="px-3 py-2 font-medium">By function</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stroke">
                  {probe.probes.map((row) => (
                    <tr key={row.label} className="text-fg">
                      <td className="px-3 py-2 font-mono">{row.label}</td>
                      <td className="px-3 py-2 font-mono font-semibold">{row.eodhdHttp}</td>
                      <td className="max-w-md px-3 py-2 font-mono text-[11px] text-fg-muted">
                        {formatFnBreakdown(row.byFn)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {probe.estimatesText ? (
              <details className="rounded-lg border border-stroke bg-surface-muted px-3 py-2">
                <summary className="cursor-pointer text-sm font-medium text-fg">
                  DAU load estimates
                </summary>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-[11px] text-fg-muted">
                  {probe.estimatesText}
                </pre>
              </details>
            ) : null}
          </div>
        ) : null}
      </article>
    </section>
  );
}
