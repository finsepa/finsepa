import { parseCryptoDetailTabQuery } from "@/lib/crypto/crypto-detail-tab";
import { parseStockDetailTabQuery } from "@/lib/stock/stock-detail-tab";
import type { WatchlistEnrichedItem } from "@/lib/watchlist/enriched-types";

const STOCK_DETAIL_PATH = /^\/stock\/[^/?#]+/i;
const CRYPTO_DETAIL_PATH = /^\/crypto\/[^/?#]+/i;

function withTabQuery(baseHref: string, tab: string): string {
  const sep = baseHref.includes("?") ? "&" : "?";
  return `${baseHref}${sep}tab=${encodeURIComponent(tab)}`;
}

/**
 * Watchlist rail links preserve the active detail tab when staying in the same asset class.
 * Cross-class navigation uses each asset's default tab (overview).
 */
export function resolveWatchlistRailHref(
  item: Pick<WatchlistEnrichedItem, "href" | "kind">,
  context: { pathname: string; tabParam: string | null },
): string {
  const { pathname, tabParam } = context;
  const onStockDetail = STOCK_DETAIL_PATH.test(pathname);
  const onCryptoDetail = CRYPTO_DETAIL_PATH.test(pathname);

  if (item.kind === "stock" && onStockDetail) {
    const tab = parseStockDetailTabQuery(tabParam);
    if (tab && tab !== "overview") return withTabQuery(item.href, tab);
    return item.href;
  }

  if (item.kind === "crypto" && onCryptoDetail) {
    const tab = parseCryptoDetailTabQuery(tabParam);
    if (tab && tab !== "overview") return withTabQuery(item.href, tab);
    return item.href;
  }

  return item.href;
}
