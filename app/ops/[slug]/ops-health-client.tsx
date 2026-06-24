"use client";

import { useCallback, useState, type FormEvent } from "react";

import {
  AuthLabel,
  AuthPrimaryButton,
  AuthTitleBlock,
} from "@/components/auth/auth-form-ui";
import { AuthPasswordInput } from "@/components/auth/auth-password-input";
import type { HealthReport, HealthStatus } from "@/lib/admin-health/types";
import { SpinnerLabel } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type Props = {
  slug: string;
  authenticated: boolean;
  initialReport: HealthReport | null;
};

const STATUS_STYLES: Record<HealthStatus, { dot: string; badge: string; label: string }> = {
  ok: {
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    label: "OK",
  },
  warn: {
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-900 ring-amber-200",
    label: "Warn",
  },
  error: {
    dot: "bg-red-500",
    badge: "bg-red-50 text-red-800 ring-red-200",
    label: "Error",
  },
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

function PasswordGate({ slug, onAuthenticated }: { slug: string; onAuthenticated: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/ops/${encodeURIComponent(slug)}/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
        credentials: "same-origin",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(data?.message ?? "Incorrect password.");
        return;
      }
      onAuthenticated();
    } catch {
      setError("Could not verify password. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center px-4 py-12">
      <div className="w-full rounded-2xl border border-[#E4E4E7] bg-white p-8 shadow-sm">
        <AuthTitleBlock
          title="Ops access"
          subtitle="Enter the ops password to view system status."
        />
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <AuthLabel>Password</AuthLabel>
            <AuthPasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <AuthPrimaryButton type="submit" disabled={loading || password.length === 0}>
            {loading ? <SpinnerLabel>Checking…</SpinnerLabel> : "Continue"}
          </AuthPrimaryButton>
        </form>
      </div>
    </main>
  );
}

function CheckCard({
  label,
  status,
  summary,
  details,
  latencyMs,
  error,
}: HealthReport["checks"][number]) {
  const styles = STATUS_STYLES[status];
  const detailEntries = details ? Object.entries(details) : [];

  return (
    <article className="rounded-xl border border-[#E4E4E7] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", styles.dot)} aria-hidden />
            <h2 className="text-sm font-semibold text-[#09090B]">{label}</h2>
          </div>
          <p className="mt-1 text-sm text-[#52525B]">{summary}</p>
          {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
            styles.badge,
          )}
        >
          {styles.label}
        </span>
      </div>
      {detailEntries.length > 0 || latencyMs != null ? (
        <dl className="mt-3 grid gap-1 border-t border-[#F4F4F5] pt-3 text-xs text-[#71717A]">
          {latencyMs != null ? (
            <div className="flex justify-between gap-4">
              <dt>Latency</dt>
              <dd className="font-mono text-[#3F3F46]">{latencyMs} ms</dd>
            </div>
          ) : null}
          {detailEntries.map(([key, value]) => (
            <div key={key} className="flex justify-between gap-4">
              <dt className="capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</dt>
              <dd className="max-w-[55%] truncate text-right font-mono text-[#3F3F46]">
                {value === null ? "—" : String(value)}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </article>
  );
}

function Dashboard({
  slug,
  report,
  onRefresh,
  refreshing,
}: {
  slug: string;
  report: HealthReport;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const okCount = report.checks.filter((c) => c.status === "ok").length;
  const warnCount = report.checks.filter((c) => c.status === "warn").length;
  const errorCount = report.checks.filter((c) => c.status === "error").length;

  async function onLogout() {
    await fetch(`/api/ops/${encodeURIComponent(slug)}/logout`, {
      method: "POST",
      credentials: "same-origin",
    });
    window.location.reload();
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#09090B]">System status</h1>
          <p className="mt-1 text-sm text-[#52525B]">
            Last checked {formatWhen(report.checkedAt)}
            {report.vercelEnv ? ` · ${report.vercelEnv}` : null}
          </p>
          <p className="mt-2 text-xs text-[#71717A]">
            {okCount} ok · {warnCount} warn · {errorCount} error
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="rounded-lg bg-[#09090B] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#27272A] disabled:opacity-60"
          >
            {refreshing ? "Refreshing…" : "Run checks"}
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-lg border border-[#E4E4E7] bg-white px-3 py-2 text-sm font-medium text-[#52525B] transition hover:bg-[#F4F4F5]"
          >
            Lock
          </button>
        </div>
      </header>

      <div className="grid gap-3">
        {report.checks.map((check) => (
          <CheckCard key={check.id} {...check} />
        ))}
      </div>
    </main>
  );
}

export function OpsHealthClient({ slug, authenticated: initialAuthenticated, initialReport }: Props) {
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);
  const [report, setReport] = useState<HealthReport | null>(initialReport);
  const [refreshing, setRefreshing] = useState(false);

  const loadReport = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/ops/${encodeURIComponent(slug)}/health`, {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Failed to load health report.");
      const data = (await res.json()) as HealthReport;
      setReport(data);
      setAuthenticated(true);
    } finally {
      setRefreshing(false);
    }
  }, [slug]);

  async function onAuthenticated() {
    await loadReport();
  }

  if (!authenticated || !report) {
    return <PasswordGate slug={slug} onAuthenticated={onAuthenticated} />;
  }

  return (
    <Dashboard slug={slug} report={report} onRefresh={loadReport} refreshing={refreshing} />
  );
}
