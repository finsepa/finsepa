import type { Superinvestor13fProfilePageData } from "@/lib/superinvestors/types";
import { clearSuperinvestor13fInMemoryCaches } from "@/lib/superinvestors/berkshire-13f";
import { deleteSuperinvestor13fSnapshotsForCik } from "@/lib/superinvestors/superinvestor-13f-holdings-transactions-snapshot";
import {
  clearSuperinvestor13fDevMemoCaches,
  filingHeadMatchesComparison,
} from "@/lib/superinvestors/superinvestor-13f-cache-utils";
import {
  cikPad10,
  getLatest13fFilingHeadCached,
} from "@/lib/superinvestors/superinvestor-13f-freshness";
import { SUPERINVESTOR_REGISTRY } from "@/lib/superinvestors/superinvestor-registry";

export type SuperinvestorProfilePageData = Superinvestor13fProfilePageData;

function devMemoProfilePage<T>(slug: string, fn: () => Promise<T>): Promise<T> {
  if (process.env.NODE_ENV === "production") return fn();
  const g = globalThis as unknown as {
    __finsepaDevMemo?: Map<string, { exp: number; v: Promise<unknown> }>;
  };
  if (!g.__finsepaDevMemo) g.__finsepaDevMemo = new Map();
  const key = `13f:profile-page:${slug}`;
  const now = Date.now();
  const ttlMs = 5 * 60 * 1000;
  const hit = g.__finsepaDevMemo.get(key);
  if (hit && hit.exp > now) return hit.v as Promise<T>;
  const v = fn();
  g.__finsepaDevMemo.set(key, { exp: now + ttlMs, v });
  return v;
}

/**
 * Match the superinvestors list page: probe SEC for the latest 13F-HR and reload when
 * cached profile data is behind (Supabase snapshot / dev memo).
 */
async function loadProfilePageMatchingLatestFilingHead(
  load: () => Promise<Superinvestor13fProfilePageData>,
): Promise<Superinvestor13fProfilePageData> {
  let page = await load();
  const cikPadded = cikPad10(page.comparison.cik);
  if (!cikPadded) return page;

  const head = await getLatest13fFilingHeadCached(cikPadded);
  if (filingHeadMatchesComparison(head, page.comparison)) return page;

  clearSuperinvestor13fDevMemoCaches();
  clearSuperinvestor13fInMemoryCaches();
  await deleteSuperinvestor13fSnapshotsForCik(cikPadded);

  page = await load();
  return page;
}

/**
 * One SEC snapshot pass per profile (comparison + transactions share filings via `getInstitutional13fSnapshots`).
 * Cached by latest 13F accession — repeat visits only probe SEC submissions JSON (~1 req/hr per filer).
 * Berkshire also persists the full page + holdings-scoped tx history in `market_snapshot` (incremental on new 13F).
 */
export async function loadSuperinvestorProfilePageData(
  slug: string,
): Promise<SuperinvestorProfilePageData | null> {
  const item = SUPERINVESTOR_REGISTRY.find((entry) => entry.slug === slug);
  if (!item) return null;

  return devMemoProfilePage(slug, () =>
    loadProfilePageMatchingLatestFilingHead(() => item.loadProfilePage()),
  );
}

/** Bust dev memo + Supabase 13F snapshots, then reload from SEC (new filing detection). */
export async function forceRefreshSuperinvestorProfilePage(
  slug: string,
): Promise<SuperinvestorProfilePageData | null> {
  const item = SUPERINVESTOR_REGISTRY.find((entry) => entry.slug === slug);
  if (!item) return null;

  clearSuperinvestor13fDevMemoCaches();
  clearSuperinvestor13fInMemoryCaches();

  const cikPadded = cikPad10((await item.loadProfilePage()).comparison.cik);
  if (cikPadded) await deleteSuperinvestor13fSnapshotsForCik(cikPadded);

  clearSuperinvestor13fDevMemoCaches();
  clearSuperinvestor13fInMemoryCaches();

  return loadProfilePageMatchingLatestFilingHead(() => item.loadProfilePage());
}

/** Cron: probe all filers and warm portfolio cache when a new 13F-HR appears. */
export async function refreshAllSuperinvestor13fPortfolios(): Promise<
  {
    slug: string;
    ok: boolean;
    filingDate: string | null;
    accession: string | null;
    error?: string;
  }[]
> {
  const results: {
    slug: string;
    ok: boolean;
    filingDate: string | null;
    accession: string | null;
    error?: string;
  }[] = [];

  for (const item of SUPERINVESTOR_REGISTRY) {
    try {
      const data = await forceRefreshSuperinvestorProfilePage(item.slug);
      if (!data) {
        results.push({
          slug: item.slug,
          ok: false,
          filingDate: null,
          accession: null,
          error: "unknown_slug",
        });
        continue;
      }
      results.push({
        slug: item.slug,
        ok: true,
        filingDate: data.comparison.current.filingDate,
        accession: data.comparison.current.accessionNumber,
      });
    } catch (e) {
      results.push({
        slug: item.slug,
        ok: false,
        filingDate: null,
        accession: null,
        error: e instanceof Error ? e.message : "load_failed",
      });
    }
  }

  return results;
}
