/** Daily bars — matches existing Portfolio callers (period=d). */
export const PORTFOLIO_EOD_GRANULARITY = "d" as const;

type CacheRoute = "equity" | "crypto";

/** Deterministic cache identity: route + provider symbol + window + retry + granularity. */
export function portfolioEodBarsCacheKey(args: {
  route: CacheRoute;
  providerSymbol: string;
  fromYmd: string;
  toYmd: string;
  retry: boolean;
}): string {
  return [
    "portfolio-eod-bars-v1",
    args.route,
    args.providerSymbol,
    args.fromYmd,
    args.toYmd,
    args.retry ? "r1" : "r0",
    PORTFOLIO_EOD_GRANULARITY,
  ].join("|");
}
