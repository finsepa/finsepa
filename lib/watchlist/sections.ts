import type { WatchlistEnrichedItem } from "@/lib/watchlist/enriched-types";
import { normalizeWatchlistStorageKey } from "@/lib/watchlist/normalize-storage-key";

export type WatchlistSection = {
  id: string;
  name: string;
};

export function newWatchlistSectionId(): string {
  return `wls_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function sectionNamesMatch(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export function normalizeWatchlistSections(raw: unknown): WatchlistSection[] {
  if (!Array.isArray(raw)) return [];
  const sections: WatchlistSection[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const id = String((entry as { id?: unknown }).id ?? "").trim();
    const name = String((entry as { name?: unknown }).name ?? "").trim();
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    sections.push({ id, name });
  }
  return sections;
}

export function normalizeTickerSections(
  raw: unknown,
  sections: WatchlistSection[],
): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const validSectionIds = new Set(sections.map((section) => section.id));
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const ticker = normalizeWatchlistStorageKey(key);
    const sectionId = String(value ?? "").trim();
    if (!ticker || !sectionId || !validSectionIds.has(sectionId)) continue;
    out[ticker] = sectionId;
  }
  return out;
}

export function emptyWatchlistSectionLayout(): {
  sections: WatchlistSection[];
  tickerSections: Record<string, string>;
} {
  return { sections: [], tickerSections: {} };
}

export type WatchlistSectionsLayout = {
  sections: WatchlistSection[];
  tickerSections: Record<string, string>;
};

export function parseSectionsLayout(raw: unknown): WatchlistSectionsLayout {
  if (!raw || typeof raw !== "object") return emptyWatchlistSectionLayout();
  const record = raw as Record<string, unknown>;
  const sections = normalizeWatchlistSections(record.sections);
  return {
    sections,
    tickerSections: normalizeTickerSections(record.tickerSections, sections),
  };
}

export function serializeSectionsLayout(layout: WatchlistSectionsLayout): Record<string, unknown> {
  return {
    sections: layout.sections.map((section) => ({ id: section.id, name: section.name })),
    tickerSections: layout.tickerSections,
  };
}

export function sectionsLayoutsEqual(left: WatchlistSectionsLayout, right: WatchlistSectionsLayout): boolean {
  if (left.sections.length !== right.sections.length) return false;
  for (let index = 0; index < left.sections.length; index++) {
    const a = left.sections[index]!;
    const b = right.sections[index];
    if (!b || a.id !== b.id || a.name !== b.name) return false;
  }

  const leftKeys = Object.keys(left.tickerSections).sort();
  const rightKeys = Object.keys(right.tickerSections).sort();
  if (leftKeys.length !== rightKeys.length) return false;
  for (let index = 0; index < leftKeys.length; index++) {
    const key = leftKeys[index]!;
    if (key !== rightKeys[index]) return false;
    if (left.tickerSections[key] !== right.tickerSections[key]) return false;
  }
  return true;
}

export function serverHasSectionsLayout(layout: WatchlistSectionsLayout): boolean {
  return layout.sections.length > 0 || Object.keys(layout.tickerSections).length > 0;
}

export function partitionEnrichedItemsBySections(
  items: WatchlistEnrichedItem[],
  watchedTickers: string[],
  sections: WatchlistSection[],
  tickerSections: Record<string, string>,
): {
  unsectioned: WatchlistEnrichedItem[];
  sections: { section: WatchlistSection; rows: WatchlistEnrichedItem[] }[];
} {
  const itemByKey = new Map(
    items.map((item) => [normalizeWatchlistStorageKey(item.storageKey), item]),
  );
  const unsectioned: WatchlistEnrichedItem[] = [];
  const rowsBySection = new Map(sections.map((section) => [section.id, [] as WatchlistEnrichedItem[]]));

  for (const ticker of watchedTickers) {
    const key = normalizeWatchlistStorageKey(ticker);
    const item = itemByKey.get(key);
    if (!item) continue;
    const sectionId = tickerSections[key];
    if (sectionId && rowsBySection.has(sectionId)) {
      rowsBySection.get(sectionId)!.push(item);
      continue;
    }
    unsectioned.push(item);
  }

  return {
    unsectioned,
    sections: sections.map((section) => ({
      section,
      rows: rowsBySection.get(section.id) ?? [],
    })),
  };
}
