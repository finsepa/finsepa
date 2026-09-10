import "server-only";

import { isDirectEarningsPdfUrl } from "@/lib/market/earnings-document-url";
import {
  BABA_DOCUMENT_JSON,
  BABA_LIST_JSON,
  babaYmFromPeriodEndYmd,
  isBabaRejected,
  parseBabaQuarterlyListJson,
  pressPdfFromBabaDocumentJson,
} from "@/lib/market/ir-seed-baba-match";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const FETCH_MS = 12_000;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

function keepBaba(url: string | null | undefined): boolean {
  return Boolean(
    url &&
      isDirectEarningsPdfUrl(url) &&
      /alibabagroup\.com/i.test(url) &&
      !isBabaRejected(url),
  );
}

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        Accept: "application/json,*/*",
        "User-Agent": UA,
        Referer: "https://www.alibabagroup.com/",
      },
      signal: AbortSignal.timeout(FETCH_MS),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * BABA: quarterly results deck as Slides; press-release PDF as Filings.
 * Match IR calendar-month titles to period-end (June 2026 → 2026-06), not March-FY labels.
 * Never lock earnings-call transcripts.
 */
export async function applyIrSeedBabaDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const needs = rows.some((r) => r.reported && (!keepBaba(r.secSlidesUrl) || !keepBaba(r.secFilingsUrl)));
  if (!needs) return rows;

  const years = [
    ...new Set(
      rows
        .map((r) => Number(r.fiscalPeriodEndYmd?.slice(0, 4)))
        .filter((y) => Number.isFinite(y) && y >= 2022 && y <= 2030),
    ),
  ];
  if (years.length === 0) return rows;

  const byYm = new Map<string, { slides: string | null; filings: string | null; pressId: string | null }>();
  await Promise.all(
    years.map(async (y) => {
      const json = await fetchJson(BABA_LIST_JSON(y));
      if (!json) return;
      for (const [ym, docs] of parseBabaQuarterlyListJson(json)) {
        const cur = byYm.get(ym) ?? { slides: null, filings: null, pressId: null };
        byYm.set(ym, {
          slides: cur.slides ?? docs.slides,
          filings: cur.filings ?? docs.filings,
          pressId: cur.pressId ?? docs.pressId,
        });
      }
    }),
  );
  if (byYm.size === 0) return rows;

  const pressIds = [...new Set([...byYm.values()].map((d) => d.pressId).filter((id): id is string => Boolean(id)))].slice(
    0,
    80,
  );
  const pressById = new Map<string, string | null>();
  await Promise.all(
    pressIds.map(async (id) => {
      const json = await fetchJson(BABA_DOCUMENT_JSON(id));
      pressById.set(id, json ? pressPdfFromBabaDocumentJson(json) : null);
    }),
  );

  return rows.map((row) => {
    if (!row.reported) return row;
    const ym = babaYmFromPeriodEndYmd(row.fiscalPeriodEndYmd);
    if (!ym) return row;
    const hit = byYm.get(ym);
    if (!hit) return row;
    const press = hit.pressId ? pressById.get(hit.pressId) ?? null : null;
    const nextSlides =
      (keepBaba(row.secSlidesUrl) ? row.secSlidesUrl : null) ??
      (hit.slides && isDirectEarningsPdfUrl(hit.slides) ? hit.slides : null);
    const nextFilings =
      (keepBaba(row.secFilingsUrl) ? row.secFilingsUrl : null) ??
      (press && isDirectEarningsPdfUrl(press) ? press : null);
    if (nextSlides === nextFilings && nextFilings) {
      return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: null };
    }
    if (nextSlides === row.secSlidesUrl && nextFilings === row.secFilingsUrl) return row;
    return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: nextFilings };
  });
}
