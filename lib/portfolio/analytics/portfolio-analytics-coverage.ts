/**
 * Coverage helpers for portfolio analytics (Phase 4).
 */

import {
  ANALYTICS_FUNDAMENTAL_COVERAGE_MIN,
  ANALYTICS_MIN_DAILY_OBS,
} from "@/lib/portfolio/analytics/portfolio-analytics-types";

export function meetsHistoryMinimum(observations: number): boolean {
  return observations >= ANALYTICS_MIN_DAILY_OBS;
}

export function meetsFundamentalCoverage(coverage: number | null | undefined): boolean {
  return coverage != null && coverage + 1e-9 >= ANALYTICS_FUNDAMENTAL_COVERAGE_MIN;
}
