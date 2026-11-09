"use client";

import { useEffect, useSyncExternalStore } from "react";

import {
  cryptoLiveQuotesFromPayload,
  type CryptoLiveQuote,
  type CryptoLiveQuotesPayload,
} from "@/lib/market/crypto-live-quotes-shared";

/** Client refresh for every crypto list surface; the route itself is CDN-cached for 5s. */
export const CRYPTO_LIVE_QUOTES_POLL_MS = 10_000;

type Snapshot = Record<string, CryptoLiveQuote> | null;

let snapshot: Snapshot = null;
let lastFetchedAtMs = 0;
let inflight: Promise<void> | null = null;
let timer: number | null = null;
let subscriberCount = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function fetchNow(): Promise<void> {
  if (inflight) return inflight;
  inflight = fetch("/api/crypto/live-quotes")
    .then(async (res) => {
      if (!res.ok) return;
      const payload = (await res.json()) as CryptoLiveQuotesPayload;
      const next = cryptoLiveQuotesFromPayload(payload);
      if (Object.keys(next).length) {
        snapshot = next;
        lastFetchedAtMs = Date.now();
        emit();
      }
    })
    .catch(() => {})
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

function tick() {
  if (typeof document !== "undefined" && document.hidden) return;
  void fetchNow();
}

function onVisibility() {
  if (!document.hidden && Date.now() - lastFetchedAtMs >= CRYPTO_LIVE_QUOTES_POLL_MS) void fetchNow();
}

/** One shared poller no matter how many surfaces are mounted. */
function retain() {
  subscriberCount += 1;
  if (subscriberCount > 1) return;
  if (Date.now() - lastFetchedAtMs >= CRYPTO_LIVE_QUOTES_POLL_MS) void fetchNow();
  timer = window.setInterval(tick, CRYPTO_LIVE_QUOTES_POLL_MS);
  document.addEventListener("visibilitychange", onVisibility);
}

function release() {
  subscriberCount = Math.max(0, subscriberCount - 1);
  if (subscriberCount > 0) return;
  if (timer != null) window.clearInterval(timer);
  timer = null;
  document.removeEventListener("visibilitychange", onVisibility);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => snapshot;

/** Latest polled quotes without subscribing (for one-shot merges outside render). */
export function getCryptoLiveQuotesSnapshot(): Snapshot {
  return snapshot;
}
const getServerSnapshot = (): Snapshot => null;

/**
 * Live exchange quotes for all covered crypto bases, refreshed every 10s while any enabled
 * surface is mounted and the tab is visible. Returns null until the first response.
 */
export function useCryptoLiveQuotes(enabled = true): Snapshot {
  useEffect(() => {
    if (!enabled) return;
    retain();
    return release;
  }, [enabled]);
  const quotes = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return enabled ? quotes : null;
}
