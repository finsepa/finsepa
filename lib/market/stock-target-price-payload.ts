import "server-only";

import type { StockAnalystDistributionBucket, StockTargetPricePayload } from "@/lib/market/stock-target-price-types";

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

function countInt(ar: Record<string, unknown> | null, keys: string[]): number {
  if (!ar) return 0;
  for (const k of keys) {
    const v = num(ar[k]);
    if (v != null && Number.isFinite(v) && v >= 0) return Math.round(v);
  }
  return 0;
}

const EMPTY: StockTargetPricePayload = {
  consensusTarget: null,
  wallStreetTarget: null,
  meanTarget: null,
  highTarget: null,
  lowTarget: null,
  fairValue: null,
  consensusLabel: null,
  distributionSummary: null,
  analystDistribution: [
    { label: "Strong buy", count: 0 },
    { label: "Buy", count: 0 },
    { label: "Neutral", count: 0 },
    { label: "Sell", count: 0 },
    { label: "Strong sell", count: 0 },
  ],
};

function firstTarget(...candidates: (number | null | undefined)[]): number | null {
  for (const c of candidates) {
    if (c != null && Number.isFinite(c)) return c;
  }
  return null;
}

function buildAnalystDistribution(ar: Record<string, unknown> | null): StockAnalystDistributionBucket[] {
  if (!ar) {
    return EMPTY.analystDistribution.map((b) => ({ ...b }));
  }
  return [
    {
      label: "Strong buy",
      count: countInt(ar, ["StrongBuy", "Strong_Buy", "StrongBuyCount", "strongBuy", "strong_buy"]),
    },
    {
      label: "Buy",
      count: countInt(ar, ["Buy", "BuyCount", "buy", "ModerateBuy", "Moderate_Buy"]),
    },
    {
      label: "Neutral",
      count: countInt(ar, [
        "Hold",
        "Neutral",
        "Neautral",
        "HoldCount",
        "NeutralCount",
        "hold",
        "neutral",
        "Underperform",
      ]),
    },
    {
      label: "Sell",
      count: countInt(ar, ["Sell", "SellCount", "sell", "Underweight"]),
    },
    {
      label: "Strong sell",
      count: countInt(ar, ["StrongSell", "Strong_Sell", "StrongSellCount", "strongSell", "strong_sell"]),
    },
  ];
}

function normalizeAnalystLabel(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

function analystBucketScore(label: string): number | null {
  const l = normalizeAnalystLabel(label);
  if (l === "strong buy") return 5;
  if (l === "buy") return 4;
  if (l === "neutral") return 3;
  if (l === "sell") return 2;
  if (l === "strong sell") return 1;
  return null;
}

function labelFromAvgScore(avg: number): string {
  if (avg >= 4.5) return "Strong buy";
  if (avg >= 3.5) return "Buy";
  if (avg >= 2.5) return "Neutral";
  if (avg >= 1.5) return "Sell";
  return "Strong sell";
}

function avgScoreFromBuckets(buckets: StockAnalystDistributionBucket[]): number | null {
  let num = 0;
  let den = 0;
  for (const b of buckets) {
    const s = analystBucketScore(b.label);
    if (s == null) continue;
    const c = b.count;
    if (!Number.isFinite(c) || c <= 0) continue;
    num += s * c;
    den += c;
  }
  if (den <= 0) return null;
  return num / den;
}

function majorityLabelFromBuckets(buckets: StockAnalystDistributionBucket[]): string | null {
  let best: { label: string; count: number; score: number } | null = null;
  for (const b of buckets) {
    const score = analystBucketScore(b.label);
    if (score == null) continue;
    const c = b.count;
    if (!Number.isFinite(c) || c <= 0) continue;
    if (!best || c > best.count || (c === best.count && score > best.score)) {
      best = { label: b.label, count: c, score };
    }
  }
  return best ? labelFromAvgScore(best.score) : null;
}

/** Title case for Key Stats / tables, e.g. `Strong buy` → `Strong Buy`. */
function formatAnalystConsensusLabel(label: string): string {
  return label
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Same consensus string as the Target Price tab gauge (majority bucket, else avg score, else EODHD text).
 */
export function analystConsensusDisplayForKeyStats(root: Record<string, unknown> | null): string | null {
  if (!root) return null;

  const ar =
    root.AnalystRatings && typeof root.AnalystRatings === "object"
      ? (root.AnalystRatings as Record<string, unknown>)
      : null;

  const recomMean = num(ar?.RecommendationMean ?? ar?.Recommendation ?? ar?.AnalystRecom);
  if (recomMean != null && recomMean >= 1 && recomMean <= 5) {
    return formatAnalystConsensusLabel(labelFromAvgScore(recomMean));
  }

  const payload = buildStockTargetPricePayload(root);
  const textLabel = payload.consensusLabel?.trim();
  if (textLabel && !/^[\d.]+$/.test(textLabel)) {
    return formatAnalystConsensusLabel(textLabel);
  }

  const buckets = payload.analystDistribution;
  const total = buckets.reduce((sum, b) => sum + (Number.isFinite(b.count) && b.count > 0 ? b.count : 0), 0);
  if (total > 0) {
    const majority = majorityLabelFromBuckets(buckets);
    if (majority) return formatAnalystConsensusLabel(majority);
    const avg = avgScoreFromBuckets(buckets);
    if (avg != null) return formatAnalystConsensusLabel(labelFromAvgScore(avg));
    if (payload.distributionSummary) return payload.distributionSummary;
  }

  return null;
}

function buildDistributionSummary(ar: Record<string, unknown>): string | null {
  const pairs: [string, string][] = [
    ["Strong Buy", "StrongBuy"],
    ["Buy", "Buy"],
    ["Hold", "Hold"],
    ["Sell", "Sell"],
    ["Strong Sell", "StrongSell"],
  ];
  const parts: string[] = [];
  for (const [label, key] of pairs) {
    const n = num(ar[key]);
    if (n != null && n > 0) parts.push(`${label} ${Math.round(n)}`);
  }
  return parts.length ? parts.join(" · ") : null;
}

/**
 * Extracts analyst price targets from an EODHD fundamentals JSON root
 * (Highlights, Valuation, AnalystRatings).
 */
export function buildStockTargetPricePayload(root: Record<string, unknown> | null): StockTargetPricePayload {
  if (!root) return { ...EMPTY };

  const hl = root.Highlights && typeof root.Highlights === "object" ? (root.Highlights as Record<string, unknown>) : null;
  const val = root.Valuation && typeof root.Valuation === "object" ? (root.Valuation as Record<string, unknown>) : null;
  const ar = root.AnalystRatings && typeof root.AnalystRatings === "object" ? (root.AnalystRatings as Record<string, unknown>) : null;

  const wallStreetTarget = num(ar?.WallStreetTargetPrice ?? hl?.WallStreetTargetPrice);
  const meanTarget = num(ar?.MeanTargetPrice ?? ar?.MeanPriceTarget);
  const genericTarget = num(ar?.TargetPrice ?? hl?.TargetPrice);

  const consensusTarget = firstTarget(
    wallStreetTarget,
    meanTarget,
    genericTarget,
    num(ar?.MedianTargetPrice),
    num(ar?.ConsensusTargetPrice),
  );

  const highTarget = firstTarget(
    num(ar?.HighPriceTarget),
    num(ar?.HighTargetPrice),
    num(ar?.HighTarget),
    num(ar?.TargetHighPrice),
    num(ar?.TargetHigh),
  );

  const lowTarget = firstTarget(
    num(ar?.LowPriceTarget),
    num(ar?.LowTargetPrice),
    num(ar?.LowTarget),
    num(ar?.TargetLowPrice),
    num(ar?.TargetLow),
  );

  const fairValue = num(val?.FairValue ?? hl?.FairValue ?? ar?.FairValue);

  const consensusLabel =
    str(ar?.Consensus) ??
    str(ar?.ConsensusRating) ??
    str(ar?.AnalystRecom) ??
    str(ar?.Rating) ??
    str(ar?.RecommendationMean) ??
    str(hl?.AnalystRating);

  const distributionSummary = ar ? buildDistributionSummary(ar) : null;
  const analystDistribution = buildAnalystDistribution(ar);

  return {
    consensusTarget,
    wallStreetTarget,
    meanTarget,
    highTarget,
    lowTarget,
    fairValue,
    consensusLabel,
    distributionSummary,
    analystDistribution,
  };
}
