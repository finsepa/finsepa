import "server-only";

import { getEodhdApiKey } from "@/lib/env/server";

export type CryptoFundamentalsMeta = {
  marketCapUsd: number | null;
  fullyDilutedMarketCapUsd: number | null;
  athMarketCapUsd: number | null;
  totalSupply: number | null;
  circulatingSupply: number | null;
  maxSupply: number | null;
  volume24hUsd: number | null;
  /** volume_24h / market_cap when both exist */
  volumeToMarketCap24h: number | null;
  website: string | null;
  whitepaper: string | null;
  github: string | null;
  twitter: string | null;
  reddit: string | null;
  telegram: string | null;
  discord: string | null;
  explorers: string[];
  wallets: string[];
};

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const cleaned = v.replace(/,/g, "").replace(/[^0-9.+-eE]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeKey(k: string): string {
  return k.toLowerCase().replace(/[^a-z0-9]/g, "");
}

type Pair = { nk: string; v: unknown };

function collectPairs(obj: unknown, depth: number, out: Pair[]) {
  if (depth > 10 || obj == null) return;
  if (Array.isArray(obj)) {
    for (const item of obj) collectPairs(item, depth + 1, out);
    return;
  }
  if (typeof obj !== "object") return;
  const rec = obj as Record<string, unknown>;
  for (const [k, v] of Object.entries(rec)) {
    const nk = normalizeKey(k);
    out.push({ nk, v });
    collectPairs(v, depth + 1, out);
  }
}

function pickNumber(pairs: Pair[], predicate: (nk: string) => boolean): number | null {
  for (const { nk, v } of pairs) {
    if (!predicate(nk)) continue;
    const n = num(v);
    if (n != null && Number.isFinite(n)) return n;
  }
  return null;
}

function isHttpUrl(s: string): boolean {
  return /^https?:\/\//i.test(s.trim());
}

function categorizeUrl(nk: string, url: string): keyof Pick<
  CryptoFundamentalsMeta,
  "website" | "whitepaper" | "github" | "twitter" | "reddit" | "telegram" | "discord"
> | "explorer" | "wallet" | null {
  const u = url.toLowerCase();
  const key = nk.toLowerCase();
  if (key.includes("whitepaper") || u.includes("whitepaper")) return "whitepaper";
  if (key.includes("github") || u.includes("github.com")) return "github";
  if (key.includes("twitter") || key.includes("x.com") || u.includes("twitter.com") || u.includes("x.com")) return "twitter";
  if (key.includes("reddit") || u.includes("reddit.com")) return "reddit";
  if (key.includes("telegram") || u.includes("t.me")) return "telegram";
  if (key.includes("discord") || u.includes("discord")) return "discord";
  if (
    key.includes("explorer") ||
    key.includes("etherscan") ||
    key.includes("blockchain") ||
    key.includes("scan") ||
    u.includes("explorer")
  )
    return "explorer";
  if (key.includes("wallet")) return "wallet";
  if (key.includes("website") || key.includes("weburl") || key.includes("homepage") || key === "web") return "website";
  return null;
}

export function extractCryptoFundamentalsMeta(root: Record<string, unknown>): CryptoFundamentalsMeta {
  const pairs: Pair[] = [];
  collectPairs(root, 0, pairs);

  const marketCapUsd =
    pickNumber(pairs, (nk) => {
      if (!nk.includes("marketcap")) return false;
      if (nk.includes("fully") || nk.includes("diluted")) return false;
      if (nk.includes("ath") || nk.includes("alltime")) return false;
      return true;
    }) ?? pickNumber(pairs, (nk) => nk === "marketcapusd" || nk === "marketcapitalization");

  const fullyDilutedMarketCapUsd =
    pickNumber(pairs, (nk) => (nk.includes("fully") && nk.includes("diluted")) || nk.includes("fullydilutedvaluation") || nk === "fdv") ??
    pickNumber(pairs, (nk) => nk.includes("fdv"));

  const athMarketCapUsd = pickNumber(
    pairs,
    (nk) =>
      (nk.includes("ath") && nk.includes("marketcap")) ||
      nk.includes("alltimehighmarketcap") ||
      nk.includes("athmarketcap"),
  );

  const circulatingSupply = pickNumber(pairs, (nk) => nk.includes("circulating") && nk.includes("supply"));
  const totalSupply = pickNumber(pairs, (nk) => nk.includes("totalsupply") || (nk.includes("total") && nk.includes("supply") && !nk.includes("circulating")));
  const maxSupply = pickNumber(pairs, (nk) => nk.includes("maxsupply") || nk === "maxsupplycrypto");

  const volume24hUsd = pickNumber(
    pairs,
    (nk) =>
      (nk.includes("volume") && (nk.includes("24") || nk.includes("24h") || nk.includes("day"))) ||
      nk.includes("volume24h") ||
      nk.includes("volumeday"),
  );

  let volumeToMarketCap24h: number | null = pickNumber(pairs, (nk) => nk.includes("volumetomarketcap") || nk.includes("volmcap"));
  if (
    volumeToMarketCap24h == null &&
    volume24hUsd != null &&
    marketCapUsd != null &&
    marketCapUsd > 0
  ) {
    volumeToMarketCap24h = volume24hUsd / marketCapUsd;
  }

  const explorers = new Set<string>();
  const wallets = new Set<string>();

  let website: string | null = null;
  let whitepaper: string | null = null;
  let github: string | null = null;
  let twitter: string | null = null;
  let reddit: string | null = null;
  let telegram: string | null = null;
  let discord: string | null = null;

  for (const { nk, v } of pairs) {
    if (typeof v !== "string" || !isHttpUrl(v)) continue;
    const url = v.trim();
    const cat = categorizeUrl(nk, url);
    if (cat === "explorer") explorers.add(url);
    else if (cat === "wallet") wallets.add(url);
    else if (cat === "website" && !website) website = url;
    else if (cat === "whitepaper" && !whitepaper) whitepaper = url;
    else if (cat === "github" && !github) github = url;
    else if (cat === "twitter" && !twitter) twitter = url;
    else if (cat === "reddit" && !reddit) reddit = url;
    else if (cat === "telegram" && !telegram) telegram = url;
    else if (cat === "discord" && !discord) discord = url;
  }

  return {
    marketCapUsd,
    fullyDilutedMarketCapUsd,
    athMarketCapUsd,
    totalSupply,
    circulatingSupply,
    maxSupply,
    volume24hUsd,
    volumeToMarketCap24h,
    website,
    whitepaper,
    github,
    twitter,
    reddit,
    telegram,
    discord,
    explorers: [...explorers],
    wallets: [...wallets],
  };
}

/**
 * Full crypto fundamentals JSON → structured meta (one HTTP call).
 */
export async function fetchEodhdCryptoFundamentalsMeta(eodhdCryptoSymbol: string): Promise<CryptoFundamentalsMeta | null> {
  const key = getEodhdApiKey();
  if (!key) return null;

  const url = `https://eodhd.com/api/fundamentals/${encodeURIComponent(eodhdCryptoSymbol)}?api_token=${encodeURIComponent(
    key,
  )}&fmt=json`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const root = (await res.json()) as Record<string, unknown> | null;
    if (!root || typeof root !== "object" || "error" in root) return null;
    return extractCryptoFundamentalsMeta(root);
  } catch {
    return null;
  }
}
