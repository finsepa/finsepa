import { toast } from "sonner";

import { eodhdCryptoSpotTickerDisplay } from "@/lib/crypto/eodhd-crypto-ticker-display";
import { WATCHLIST_CRYPTO_PREFIX, WATCHLIST_INDEX_PREFIX } from "@/lib/watchlist/constants";

/** Human-readable symbol for Sonner copy (MSFT, BTC, GSPC.INDX, …). */
export function watchlistToastLabel(storageKey: string): string {
  const key = storageKey.trim().toUpperCase();
  if (key.startsWith(WATCHLIST_CRYPTO_PREFIX)) {
    return eodhdCryptoSpotTickerDisplay(key.slice(WATCHLIST_CRYPTO_PREFIX.length));
  }
  if (key.startsWith(WATCHLIST_INDEX_PREFIX)) {
    return key.slice(WATCHLIST_INDEX_PREFIX.length);
  }
  return key;
}

export function toastWatchlistAdded(storageKey: string, watchlistName?: string): void {
  const label = watchlistToastLabel(storageKey);
  toast.success("Added to watchlist", {
    description: watchlistName
      ? `${label} added to "${watchlistName}".`
      : `${label} added to your watchlist.`,
  });
}

export function toastWatchlistRemoved(
  storageKey: string,
  options?: { watchlistName?: string; scope?: "active" | "all" },
): void {
  const label = watchlistToastLabel(storageKey);
  let description: string;
  if (options?.scope === "active" && options.watchlistName) {
    description = `${label} removed from "${options.watchlistName}".`;
  } else if (options?.scope === "all") {
    description = `${label} removed from your watchlists.`;
  } else {
    description = `${label} removed from your watchlist.`;
  }
  toast.success("Removed from watchlist", { description });
}

export function toastWatchlistAddFailed(): void {
  toast.error("Could not add to watchlist", {
    description: "Try again in a moment.",
  });
}

export function toastWatchlistRemoveFailed(): void {
  toast.error("Could not remove from watchlist", {
    description: "Try again in a moment.",
  });
}

export function toastWatchlistNotReady(): void {
  toast.error("Watchlist is still loading", {
    description: "Try again in a moment.",
  });
}

export function toastWatchlistSyncFailed(): void {
  toast.error("Watchlist not synced", {
    description: "Saved on this device — we'll retry syncing to your account.",
  });
}
