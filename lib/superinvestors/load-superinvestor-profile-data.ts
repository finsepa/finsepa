import type { Superinvestor13fProfilePageData } from "@/lib/superinvestors/berkshire-13f";
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
 * One SEC snapshot pass per profile (comparison + transactions share filings via `getInstitutional13fSnapshots`).
 * All `/superinvestors/*` pages use this; UI is shared via `SuperinvestorProfileBySlug`.
 */
export async function loadSuperinvestorProfilePageData(
  slug: string,
): Promise<SuperinvestorProfilePageData | null> {
  const item = SUPERINVESTOR_REGISTRY.find((entry) => entry.slug === slug);
  if (!item) return null;

  return devMemoProfilePage(slug, () => item.loadProfilePage());
}
