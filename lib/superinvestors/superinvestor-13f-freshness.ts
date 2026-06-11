import "server-only";

import { unstable_cache } from "next/cache";

import { getSecEdgarUserAgent } from "@/lib/env/server";

/** Latest 13F-HR on EDGAR (submissions JSON only — no infotable XML). */
export type Superinvestor13fFilingHead = {
  accession: string;
  filingDate: string | null;
  reportDate: string | null;
  filerName: string;
};

type SubmissionsRecent = {
  form?: string[];
  accessionNumber?: string[];
  filingDate?: string[];
  reportDate?: string[];
};

type SubmissionsColumnarPayload = {
  filings?: { recent?: SubmissionsRecent };
  form?: string[];
  accessionNumber?: string[];
  filingDate?: string[];
  reportDate?: string[];
};

function submissionsColumnFromPayload(payload: SubmissionsColumnarPayload): SubmissionsRecent | undefined {
  if (payload.filings?.recent) return payload.filings.recent;
  if (payload.form?.length) {
    return {
      form: payload.form,
      accessionNumber: payload.accessionNumber,
      filingDate: payload.filingDate,
      reportDate: payload.reportDate,
    };
  }
  return undefined;
}

function is13fHrForm(form: string): boolean {
  return form === "13F-HR" || form === "13F-HR/A";
}

function extractLatest13fRef(recent: SubmissionsRecent | undefined): Omit<Superinvestor13fFilingHead, "filerName"> | null {
  const forms = recent?.form ?? [];
  const accessionNumbers = recent?.accessionNumber ?? [];
  const filingDates = recent?.filingDate ?? [];
  const reportDates = recent?.reportDate ?? [];
  for (let i = 0; i < forms.length; i++) {
    if (!is13fHrForm(forms[i] ?? "")) continue;
    const accession = accessionNumbers[i]?.trim();
    if (!accession) continue;
    return {
      accession,
      filingDate: filingDates[i] ?? null,
      reportDate: reportDates[i] ?? null,
    };
  }
  return null;
}

/** How often we ask SEC “any new 13F?” (one small JSON per filer). */
export const REVALIDATE_13F_FILING_HEAD_SEC = 3_600;

/** Parsed portfolio cache; invalidated when {@link thirteenFilingHeadCacheKey} changes. */
export const REVALIDATE_13F_PORTFOLIO_BY_ACCESSION_SEC = 2_592_000;

export function cikPad10(cik: string): string {
  const digits = cik.replace(/\D/g, "");
  if (!digits) return "";
  return digits.padStart(10, "0").slice(-10);
}

async function secFetch(url: string, init: RequestInit & { headers: HeadersInit }): Promise<Response> {
  return fetch(url, { ...init, cache: "no-store" });
}

async function loadLatest13fFilingHeadUncached(cikPadded: string): Promise<Superinvestor13fFilingHead | null> {
  const ua = getSecEdgarUserAgent();
  const subUrl = `https://data.sec.gov/submissions/CIK${cikPadded}.json`;
  const subRes = await secFetch(subUrl, {
    headers: { "User-Agent": ua, Accept: "application/json" },
  });
  if (!subRes.ok) return null;

  const root = (await subRes.json()) as SubmissionsColumnarPayload & { name?: string };
  const filerName =
    typeof root.name === "string" && root.name.trim() ? root.name.trim() : "Institutional investment manager";
  const latest = extractLatest13fRef(submissionsColumnFromPayload(root));
  if (!latest) return null;
  return { ...latest, filerName };
}

export function thirteenFilingHeadCacheKey(head: Superinvestor13fFilingHead | null): string {
  if (!head?.accession?.trim()) return "none";
  return head.accession.trim().replace(/-/g, "").toLowerCase();
}

export function getLatest13fFilingHeadCached(cikPadded: string): Promise<Superinvestor13fFilingHead | null> {
  const uncached = () => loadLatest13fFilingHeadUncached(cikPadded);
  if (process.env.NODE_ENV !== "production") return uncached();
  return unstable_cache(uncached, ["superinvestor-13f-filing-head-v2", cikPadded], {
    revalidate: REVALIDATE_13F_FILING_HEAD_SEC,
  })();
}

/**
 * Cache heavy 13F portfolio work until SEC shows a new latest accession (Dataroma-style).
 * Page loads: 1 submissions JSON probe/hour; XML infotable only on new filing.
 */
export async function withAccessionKeyed13fCache<T>(
  cachePrefix: string,
  cik: string,
  loadUncached: () => Promise<T>,
): Promise<T> {
  if (process.env.NODE_ENV !== "production") return loadUncached();
  const padded = cikPad10(cik);
  const head = await getLatest13fFilingHeadCached(padded);
  const accKey = thirteenFilingHeadCacheKey(head);
  return unstable_cache(loadUncached, [cachePrefix, padded, accKey], {
    revalidate: REVALIDATE_13F_PORTFOLIO_BY_ACCESSION_SEC,
  })();
}
