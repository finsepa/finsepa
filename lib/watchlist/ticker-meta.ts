import { logoColors, screenerData } from "@/components/screener/data";

const tickerToName = new Map(
  screenerData.map((row) => [row.ticker.trim().toUpperCase(), row.name]),
);

export type WatchlistDisplayMeta = {
  displayName: string;
  frameClass: string;
  initials: string;
};

/** Resolve company label + logo palette from screener mock data; fallback to ticker initials. */
export function getWatchlistTickerMeta(ticker: string): WatchlistDisplayMeta {
  const key = ticker.trim().toUpperCase();
  const resolvedName = tickerToName.get(key);
  const displayName = resolvedName ?? key;

  const palette = logoColors[displayName] ?? {
    bg: "bg-neutral-100",
    text: "text-neutral-600",
    border: "border-neutral-200",
  };

  const initialsSource = resolvedName ?? key;
  const initials =
    initialsSource.length >= 2
      ? initialsSource.slice(0, 2).toUpperCase()
      : `${initialsSource}${initialsSource}`.slice(0, 2).toUpperCase();

  return {
    displayName,
    initials,
    frameClass: `flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-[11px] font-bold ${palette.bg} ${palette.text} ${palette.border}`,
  };
}
