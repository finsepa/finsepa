import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_STATIC_DAY } from "@/lib/data/cache-policy";
import { parseFarsideBtcEtfFlowTotals } from "@/lib/market/farside-btc-etf-flows-parse";

export { parseFarsideBtcEtfFlowTotals } from "@/lib/market/farside-btc-etf-flows-parse";

/** Farside publishes US spot Bitcoin ETF daily net flows in US$m. */
export const FARSIDE_BTC_ETF_ALL_DATA_URL = "https://farside.co.uk/bitcoin-etf-flow-all-data/";

/** Free reader proxy — used when Cloudflare blocks direct fetches from serverless IPs. */
const FARSIDE_JINA_READER_URL = `https://r.jina.ai/http://farside.co.uk/bitcoin-etf-flow-all-data/`;

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "text/html,text/plain,text/markdown,*/*",
        "User-Agent":
          "Mozilla/5.0 (compatible; FinsepaMacro/1.0; +https://finsepa.com; BTC ETF flow chart)",
      },
      next: { revalidate: REVALIDATE_STATIC_DAY },
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || /just a moment|cf-chl|challenge-platform/i.test(text)) return null;
    return text;
  } catch {
    return null;
  }
}

async function fetchFarsideBtcEtfFlowTotalsUncached(): Promise<Array<{ time: string; value: number }>> {
  const direct = await fetchText(FARSIDE_BTC_ETF_ALL_DATA_URL);
  let points = direct ? parseFarsideBtcEtfFlowTotals(direct) : [];
  if (points.length >= 30) return points;

  const viaJina = await fetchText(FARSIDE_JINA_READER_URL);
  points = viaJina ? parseFarsideBtcEtfFlowTotals(viaJina) : [];
  return points.length >= 30 ? points : [];
}

const getFarsideBtcEtfFlowsCached = unstable_cache(
  fetchFarsideBtcEtfFlowTotalsUncached,
  ["farside-btc-etf-net-flows-v1"],
  { revalidate: REVALIDATE_STATIC_DAY },
);

/** Daily US spot Bitcoin ETF aggregate net flow (USD), cached ~24h. Source: Farside Investors. */
export async function fetchFarsideBtcEtfNetFlowMacroSeriesCached(): Promise<
  Array<{ time: string; value: number }>
> {
  return getFarsideBtcEtfFlowsCached();
}
