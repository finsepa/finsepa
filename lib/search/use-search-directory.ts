"use client";

import { useEffect, useState } from "react";

import type { SearchDirectoryPayload } from "@/lib/search/search-directory-types";

/** Matches the server's 60s directory cache — reopening search within that window costs no request. */
const CLIENT_TTL_MS = 60_000;

let cached: { payload: SearchDirectoryPayload; fetchedAt: number } | null = null;
let inflight: Promise<SearchDirectoryPayload | null> | null = null;

function loadSearchDirectory(): Promise<SearchDirectoryPayload | null> {
  if (cached && Date.now() - cached.fetchedAt < CLIENT_TTL_MS) return Promise.resolve(cached.payload);
  if (inflight) return inflight;
  inflight = fetch("/api/search/directory")
    .then(async (res) => (res.ok ? ((await res.json()) as SearchDirectoryPayload) : null))
    .then((payload) => {
      if (payload) cached = { payload, fetchedAt: Date.now() };
      return payload ?? cached?.payload ?? null;
    })
    .catch(() => cached?.payload ?? null)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Warm the directory before the dialog opens (e.g. on search pill hover). */
export function prefetchSearchDirectory(): void {
  void loadSearchDirectory();
}

export function useSearchDirectory(enabled: boolean): SearchDirectoryPayload | null {
  const [payload, setPayload] = useState<SearchDirectoryPayload | null>(() => cached?.payload ?? null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void loadSearchDirectory().then((p) => {
      if (alive && p) setPayload(p);
    });
    return () => {
      alive = false;
    };
  }, [enabled]);
  return payload;
}
