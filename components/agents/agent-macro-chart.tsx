"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { MacroCard, type MacroCardModel } from "@/components/macro/macro-card";
import {
  DEFAULT_BTC_ETF_FLOW_RANGE,
  DEFAULT_MACRO_RANGE,
  type MacroRangeId,
} from "@/components/macro/macro-range";
import { Spinner } from "@/components/ui/spinner";
import { ChevronRight } from "@/lib/icons";
import { cn } from "@/lib/utils";

type HubCardPayload = {
  ok: boolean;
  openInApp?: string;
  items?: MacroCardModel[];
  note?: string;
};

const cardById = new Map<string, MacroCardModel | null>();
const waiters = new Map<string, Array<(card: MacroCardModel | null) => void>>();
const pendingFetch = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function rangeForSeries(id: string): MacroRangeId {
  return id === "btc_etf_net_flow" ? DEFAULT_BTC_ETF_FLOW_RANGE : DEFAULT_MACRO_RANGE;
}

function notify(id: string, card: MacroCardModel | null) {
  cardById.set(id, card);
  const cbs = waiters.get(id);
  waiters.delete(id);
  if (!cbs) return;
  for (const cb of cbs) cb(card);
}

async function flushPending() {
  flushTimer = null;
  const ids = [...pendingFetch].filter((id) => !cardById.has(id));
  pendingFetch.clear();
  if (ids.length === 0) return;

  try {
    const res = await fetch(`/api/agents/macro-hub?ids=${encodeURIComponent(ids.join(","))}`, {
      credentials: "include",
    });
    const json = (await res.json()) as HubCardPayload;
    const found = new Map<string, MacroCardModel>();
    for (const item of json.items ?? []) {
      if (item?.id && Array.isArray(item.points) && item.points.length >= 2) {
        found.set(item.id, item);
      }
    }
    for (const id of ids) {
      notify(id, found.get(id) ?? null);
    }
  } catch {
    for (const id of ids) {
      notify(id, null);
    }
  }
}

function resolveMacroCard(seriesId: string): Promise<MacroCardModel | null> {
  const id = seriesId.trim();
  if (!id) return Promise.resolve(null);
  if (cardById.has(id)) return Promise.resolve(cardById.get(id) ?? null);

  return new Promise((resolve) => {
    const list = waiters.get(id) ?? [];
    list.push(resolve);
    waiters.set(id, list);
    pendingFetch.add(id);
    if (flushTimer == null) {
      flushTimer = setTimeout(() => {
        void flushPending();
      }, 16);
    }
  });
}

/** Marker written by the model: [[macro-chart:series_id]] */
export const AGENT_MACRO_CHART_MARKER_RE =
  /^\[\[macro-chart:([a-z0-9_]+)\]\]$/i;

export function parseAgentMacroChartMarker(line: string): string | null {
  const m = line.trim().match(AGENT_MACRO_CHART_MARKER_RE);
  return m?.[1]?.trim() || null;
}

export function AgentMacroChartEmbed({
  seriesId,
  className,
}: {
  seriesId: string;
  className?: string;
}) {
  const [model, setModel] = useState<MacroCardModel | null>(() =>
    cardById.has(seriesId) ? (cardById.get(seriesId) ?? null) : null,
  );
  const [status, setStatus] = useState<"loading" | "ready" | "missing">(() =>
    cardById.has(seriesId) ? (cardById.get(seriesId) ? "ready" : "missing") : "loading",
  );

  useEffect(() => {
    let cancelled = false;
    if (cardById.has(seriesId)) {
      const cached = cardById.get(seriesId) ?? null;
      setModel(cached);
      setStatus(cached ? "ready" : "missing");
      return;
    }
    setStatus("loading");
    setModel(null);
    void resolveMacroCard(seriesId).then((card) => {
      if (cancelled) return;
      if (card) {
        setModel(card);
        setStatus("ready");
      } else {
        setStatus("missing");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [seriesId]);

  if (status === "loading") {
    return (
      <div
        className={cn(
          "flex min-h-[120px] w-full max-w-xl items-center justify-center rounded-2xl border border-stroke-subtle bg-surface",
          className,
        )}
        aria-busy="true"
        aria-label="Loading macro chart"
      >
        <Spinner className="size-5 text-[#71717A]" />
      </div>
    );
  }

  if (status === "missing" || !model) {
    return (
      <p className={cn("text-[14px] leading-5 text-fg-muted", className)}>
        Chart unavailable from cache — open{" "}
        <Link
          prefetch={false}
          href={`/macro#macro-card-${seriesId}`}
          className="group inline-flex items-center gap-0.5 font-semibold text-fg no-underline underline-offset-2 hover:underline"
        >
          Macro
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-fg-subtle" strokeWidth={2} aria-hidden />
        </Link>
      </p>
    );
  }

  const chartVariant = model.id === "btc_etf_net_flow" ? "bar" : "area";

  return (
    <div className={cn("w-full max-w-xl min-w-0", className)}>
      <MacroCard model={model} rangeId={rangeForSeries(model.id)} chartVariant={chartVariant} />
    </div>
  );
}
