export const WATCHLIST_DRAG_MIME = "application/x-finsepa-watchlist-item";
export const WATCHLIST_SECTION_DRAG_MIME = "application/x-finsepa-watchlist-section";

export type WatchlistDragPayload = {
  globalIndex: number;
  storageKey: string;
};

export type WatchlistSectionDragPayload = {
  sectionIndex: number;
  sectionId: string;
};

export type WatchlistDropTarget =
  | { kind: "row"; toIndex: number; sectionId: string | null }
  | { kind: "section"; sectionId: string };

export function writeWatchlistDragData(
  dataTransfer: DataTransfer,
  payload: WatchlistDragPayload,
): void {
  const encoded = JSON.stringify(payload);
  dataTransfer.setData(WATCHLIST_DRAG_MIME, encoded);
  dataTransfer.setData("text/plain", String(payload.globalIndex));
  dataTransfer.effectAllowed = "move";
}

export function readWatchlistDragData(dataTransfer: DataTransfer): WatchlistDragPayload | null {
  const raw = dataTransfer.getData(WATCHLIST_DRAG_MIME);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<WatchlistDragPayload>;
      if (
        typeof parsed.globalIndex === "number" &&
        Number.isFinite(parsed.globalIndex) &&
        typeof parsed.storageKey === "string"
      ) {
        return { globalIndex: parsed.globalIndex, storageKey: parsed.storageKey };
      }
    } catch {
      /* fall through */
    }
  }

  const fromIndex = Number(dataTransfer.getData("text/plain"));
  if (!Number.isFinite(fromIndex)) return null;
  return { globalIndex: fromIndex, storageKey: "" };
}

export function writeWatchlistSectionDragData(
  dataTransfer: DataTransfer,
  payload: WatchlistSectionDragPayload,
): void {
  dataTransfer.setData(WATCHLIST_SECTION_DRAG_MIME, JSON.stringify(payload));
  dataTransfer.effectAllowed = "move";
}

export function readWatchlistSectionDragData(
  dataTransfer: DataTransfer,
): WatchlistSectionDragPayload | null {
  const raw = dataTransfer.getData(WATCHLIST_SECTION_DRAG_MIME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<WatchlistSectionDragPayload>;
    if (
      typeof parsed.sectionIndex === "number" &&
      Number.isFinite(parsed.sectionIndex) &&
      typeof parsed.sectionId === "string"
    ) {
      return { sectionIndex: parsed.sectionIndex, sectionId: parsed.sectionId };
    }
  } catch {
    return null;
  }
  return null;
}
