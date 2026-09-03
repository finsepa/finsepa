import type { PortfolioGoal } from "@/components/portfolio/portfolio-types";

/** Assumed annual return for the main portfolio projection line. */
export const GOAL_PORTFOLIO_ANNUAL_RETURN = 0.2;
/** Assumed annual return for the conservative “safe” line. */
export const GOAL_SAFE_ANNUAL_RETURN = 0.1;
/** Added to the portfolio return for the “aggressive” line (percentage points, e.g. 28.49% → 38.49%). */
export const GOAL_AGGRESSIVE_RETURN_OFFSET = 0.1;

export type PortfolioGoalProjectionOptions = {
  /** Estimated annual dividend income — used when goal.reinvestDividends is true. */
  annualDividendUsd?: number | null;
};

/** Assumed annual dividend growth when the goal does not store a custom rate. */
export const GOAL_DEFAULT_DIVIDEND_GROWTH_PCT = 5;

export type PortfolioPassiveIncomeProjectionOptions = {
  /** Live holdings yield (%). Used when the goal has no saved yield. */
  currentYieldPct?: number | null;
  /** Live annual dividend income — drives the progress tile, not the modeled path. */
  currentAnnualIncomeUsd?: number | null;
  /** Frozen clock for tests. */
  now?: Date;
};

function portfolioAnnualReturn(goal: PortfolioGoal): number {
  if (
    goal.portfolioAnnualReturnPct != null &&
    Number.isFinite(goal.portfolioAnnualReturnPct)
  ) {
    return goal.portfolioAnnualReturnPct / 100;
  }
  return GOAL_PORTFOLIO_ANNUAL_RETURN;
}

function aggressiveAnnualReturn(goal: PortfolioGoal): number {
  return Math.min(1, portfolioAnnualReturn(goal) + GOAL_AGGRESSIVE_RETURN_OFFSET);
}

/** Normal scenario annual return (%), from goal settings. */
export function portfolioGoalNormalReturnPct(goal: PortfolioGoal): number {
  return portfolioAnnualReturn(goal) * 100;
}

/** Aggressive scenario annual return (%) — normal + 10 percentage points. */
export function portfolioGoalAggressiveReturnPct(goal: PortfolioGoal): number {
  return aggressiveAnnualReturn(goal) * 100;
}

/** Safe scenario annual return (%). */
export function portfolioGoalSafeReturnPct(): number {
  return GOAL_SAFE_ANNUAL_RETURN * 100;
}

/** Dividend yield (%) for a passive-income goal. */
export function portfolioGoalDividendYieldPct(
  goal: PortfolioGoal,
  currentYieldPct?: number | null,
): number {
  if (goal.dividendYieldPct != null && Number.isFinite(goal.dividendYieldPct)) {
    return goal.dividendYieldPct;
  }
  if (currentYieldPct != null && Number.isFinite(currentYieldPct) && currentYieldPct >= 0) {
    return currentYieldPct;
  }
  return 0;
}

/** Dividend growth (%) for a passive-income goal. */
export function portfolioGoalDividendGrowthPct(goal: PortfolioGoal): number {
  if (goal.dividendGrowthPct != null && Number.isFinite(goal.dividendGrowthPct)) {
    return goal.dividendGrowthPct;
  }
  return GOAL_DEFAULT_DIVIDEND_GROWTH_PCT;
}

function dividendYieldAnnual(
  currentValue: number,
  reinvestDividends: boolean,
  annualDividendUsd: number | null | undefined,
): number {
  if (!reinvestDividends || annualDividendUsd == null || !Number.isFinite(annualDividendUsd)) {
    return 0;
  }
  if (currentValue <= 0 || annualDividendUsd <= 0) return 0;
  return annualDividendUsd / currentValue;
}

export type PortfolioGoalYearRow = {
  label: string;
  year: number | null;
  portfolioValue: number;
  aggressiveValue: number;
  safeValue: number;
};

export type PortfolioGoalProjection = {
  progressPct: number;
  achievableMonths: number | null;
  achievableYear: number | null;
  achievableYears: number | null;
  /** When the conservative safe line (10% return) reaches the target. */
  safeAchievableMonths: number | null;
  safeAchievableYear: number | null;
  safeAchievableYears: number | null;
  /** When the aggressive line (portfolio return + 10%) reaches the target. */
  aggressiveAchievableMonths: number | null;
  aggressiveAchievableYear: number | null;
  aggressiveAchievableYears: number | null;
  rows: PortfolioGoalYearRow[];
  chartEndYear: number;
  portfolioPoints: { year: number; value: number }[];
  safePoints: { year: number; value: number }[];
  aggressivePoints: { year: number; value: number }[];
};

function monthlyRate(annual: number): number {
  return (1 + annual) ** (1 / 12) - 1;
}

function projectValue(
  startValue: number,
  monthlyContribution: number,
  annualReturn: number,
  months: number,
  dividendYieldAnnual = 0,
): number {
  const r = monthlyRate(annualReturn);
  const monthlyDivRate = dividendYieldAnnual > 0 ? dividendYieldAnnual / 12 : 0;
  let v = startValue;
  for (let i = 0; i < months; i++) {
    v = v * (1 + r) + monthlyContribution;
    if (monthlyDivRate > 0) {
      v += v * monthlyDivRate;
    }
  }
  return v;
}

function monthsToReach(
  startValue: number,
  monthlyContribution: number,
  annualReturn: number,
  target: number,
  dividendYieldAnnual = 0,
  maxMonths = 600,
): number | null {
  if (startValue >= target) return 0;
  const r = monthlyRate(annualReturn);
  const monthlyDivRate = dividendYieldAnnual > 0 ? dividendYieldAnnual / 12 : 0;
  let v = startValue;
  for (let m = 1; m <= maxMonths; m++) {
    v = v * (1 + r) + monthlyContribution;
    if (monthlyDivRate > 0) {
      v += v * monthlyDivRate;
    }
    if (v >= target) return m;
  }
  return null;
}

/** Whole months of growth from `from` until `to` (exclusive end stepping by calendar month). */
function monthsFromNowToDate(from: Date, to: Date): number {
  if (to <= from) return 0;
  let months = 0;
  const cursor = new Date(from.getTime());
  while (cursor < to) {
    cursor.setMonth(cursor.getMonth() + 1);
    months++;
  }
  return months;
}

function achievableFromMonths(
  now: Date,
  months: number | null,
): { year: number | null; years: number | null } {
  if (months == null) return { year: null, years: null };
  const hitDate = new Date(now.getTime());
  hitDate.setMonth(hitDate.getMonth() + months);
  return {
    year: hitDate.getFullYear(),
    years: Math.max(1, Math.ceil(months / 12)),
  };
}

export function computePortfolioGoalProjection(
  currentValue: number,
  goal: PortfolioGoal,
  options: PortfolioGoalProjectionOptions = {},
): PortfolioGoalProjection {
  const now = new Date();
  const currentYear = now.getFullYear();
  const target = goal.targetUsd;
  const progressPct = target > 0 ? Math.min(100, (currentValue / target) * 100) : 0;

  const portfolioReturn = portfolioAnnualReturn(goal);
  const aggressiveReturn = aggressiveAnnualReturn(goal);
  const divYield = dividendYieldAnnual(
    currentValue,
    goal.reinvestDividends === true,
    options.annualDividendUsd,
  );

  const achievableMonths = monthsToReach(
    currentValue,
    goal.monthlyContributionUsd,
    portfolioReturn,
    target,
    divYield,
  );

  const safeAchievableMonths = monthsToReach(
    currentValue,
    goal.monthlyContributionUsd,
    GOAL_SAFE_ANNUAL_RETURN,
    target,
  );

  const aggressiveAchievableMonths = monthsToReach(
    currentValue,
    goal.monthlyContributionUsd,
    aggressiveReturn,
    target,
  );

  const { year: achievableYear, years: achievableYears } = achievableFromMonths(
    now,
    achievableMonths,
  );
  const { year: safeAchievableYear, years: safeAchievableYears } = achievableFromMonths(
    now,
    safeAchievableMonths,
  );
  const { year: aggressiveAchievableYear, years: aggressiveAchievableYears } =
    achievableFromMonths(now, aggressiveAchievableMonths);

  /** Chart ends a couple of years after the latest milestone (achievable or target year). */
  const CHART_YEARS_AFTER_MILESTONE = 2;
  const latestMilestoneYear = Math.max(
    achievableYear ?? 0,
    safeAchievableYear ?? 0,
    aggressiveAchievableYear ?? 0,
    goal.achieveByYear,
  );
  const chartEndYear = Math.max(
    latestMilestoneYear + CHART_YEARS_AFTER_MILESTONE,
    currentYear + 2,
  );

  const rows: PortfolioGoalYearRow[] = [];
  const portfolioPoints: { year: number; value: number }[] = [];
  const safePoints: { year: number; value: number }[] = [];
  const aggressivePoints: { year: number; value: number }[] = [];

  rows.push({
    label: String(currentYear),
    year: currentYear,
    portfolioValue: currentValue,
    aggressiveValue: currentValue,
    safeValue: currentValue,
  });

  portfolioPoints.push({ year: currentYear, value: currentValue });
  safePoints.push({ year: currentYear, value: currentValue });
  aggressivePoints.push({ year: currentYear, value: currentValue });

  for (let year = currentYear + 1; year <= chartEndYear; year++) {
    const endOfYear = new Date(year, 11, 31, 23, 59, 59);
    const months = monthsFromNowToDate(now, endOfYear);
    const portfolioValue = projectValue(
      currentValue,
      goal.monthlyContributionUsd,
      portfolioReturn,
      months,
      divYield,
    );
    const safeValue = projectValue(
      currentValue,
      goal.monthlyContributionUsd,
      GOAL_SAFE_ANNUAL_RETURN,
      months,
    );
    const aggressiveValue = projectValue(
      currentValue,
      goal.monthlyContributionUsd,
      aggressiveReturn,
      months,
    );
    rows.push({
      label: String(year),
      year,
      portfolioValue,
      aggressiveValue,
      safeValue,
    });
    portfolioPoints.push({ year, value: portfolioValue });
    safePoints.push({ year, value: safeValue });
    aggressivePoints.push({ year, value: aggressiveValue });
  }

  const tableEndYear = Math.max(goal.achieveByYear + 2, currentYear + 3);
  const tableRows = rows.filter((r) => r.year == null || r.year <= tableEndYear);

  return {
    progressPct,
    achievableMonths,
    achievableYear,
    achievableYears,
    safeAchievableMonths,
    safeAchievableYear,
    safeAchievableYears,
    aggressiveAchievableMonths,
    aggressiveAchievableYear,
    aggressiveAchievableYears,
    rows: tableRows,
    chartEndYear,
    portfolioPoints,
    safePoints,
    aggressivePoints,
  };
}

function projectAnnualIncome(
  startEquity: number,
  monthlyContribution: number,
  yieldAnnual: number,
  growthAnnual: number,
  months: number,
): number {
  let principal = Math.max(0, startEquity);
  let y = Math.max(0, yieldAnnual);
  const g = monthlyRate(growthAnnual);
  for (let i = 0; i < months; i++) {
    principal += monthlyContribution;
    y *= 1 + g;
  }
  return principal * y;
}

function monthsToReachIncome(
  startEquity: number,
  monthlyContribution: number,
  yieldAnnual: number,
  growthAnnual: number,
  target: number,
  maxMonths = 600,
): number | null {
  if (projectAnnualIncome(startEquity, monthlyContribution, yieldAnnual, growthAnnual, 0) >= target) {
    return 0;
  }
  let principal = Math.max(0, startEquity);
  let y = Math.max(0, yieldAnnual);
  const g = monthlyRate(growthAnnual);
  for (let m = 1; m <= maxMonths; m++) {
    principal += monthlyContribution;
    y *= 1 + g;
    if (principal * y >= target) return m;
  }
  return null;
}

/**
 * Single-scenario projection: annual dividend income from holdings yield,
 * monthly contributions, and assumed dividend growth.
 */
export function computePortfolioPassiveIncomeProjection(
  startEquityUsd: number,
  goal: PortfolioGoal,
  options: PortfolioPassiveIncomeProjectionOptions = {},
): PortfolioGoalProjection {
  const now = options.now ?? new Date();
  const currentYear = now.getFullYear();
  const target = goal.targetUsd;
  const liveIncome =
    options.currentAnnualIncomeUsd != null && Number.isFinite(options.currentAnnualIncomeUsd)
      ? Math.max(0, options.currentAnnualIncomeUsd)
      : null;
  const progressPct =
    target > 0 && liveIncome != null ? Math.min(100, (liveIncome / target) * 100) : 0;

  const yieldAnnual = portfolioGoalDividendYieldPct(goal, options.currentYieldPct) / 100;
  const growthAnnual = portfolioGoalDividendGrowthPct(goal) / 100;
  const equity = Math.max(0, startEquityUsd);

  const achievableMonths = monthsToReachIncome(
    equity,
    goal.monthlyContributionUsd,
    yieldAnnual,
    growthAnnual,
    target,
  );
  const { year: achievableYear, years: achievableYears } = achievableFromMonths(now, achievableMonths);

  const CHART_YEARS_AFTER_MILESTONE = 2;
  const latestMilestoneYear = Math.max(achievableYear ?? 0, goal.achieveByYear);
  const chartEndYear = Math.max(latestMilestoneYear + CHART_YEARS_AFTER_MILESTONE, currentYear + 2);

  const rows: PortfolioGoalYearRow[] = [];
  const portfolioPoints: { year: number; value: number }[] = [];

  const startIncome = projectAnnualIncome(
    equity,
    goal.monthlyContributionUsd,
    yieldAnnual,
    growthAnnual,
    0,
  );
  rows.push({
    label: String(currentYear),
    year: currentYear,
    portfolioValue: startIncome,
    aggressiveValue: startIncome,
    safeValue: startIncome,
  });
  portfolioPoints.push({ year: currentYear, value: startIncome });

  for (let year = currentYear + 1; year <= chartEndYear; year++) {
    const endOfYear = new Date(year, 11, 31, 23, 59, 59);
    const months = monthsFromNowToDate(now, endOfYear);
    const income = projectAnnualIncome(
      equity,
      goal.monthlyContributionUsd,
      yieldAnnual,
      growthAnnual,
      months,
    );
    rows.push({
      label: String(year),
      year,
      portfolioValue: income,
      aggressiveValue: income,
      safeValue: income,
    });
    portfolioPoints.push({ year, value: income });
  }

  const tableEndYear = Math.max(goal.achieveByYear + 2, currentYear + 3);
  const tableRows = rows.filter((r) => r.year == null || r.year <= tableEndYear);

  return {
    progressPct,
    achievableMonths,
    achievableYear,
    achievableYears,
    safeAchievableMonths: null,
    safeAchievableYear: null,
    safeAchievableYears: null,
    aggressiveAchievableMonths: null,
    aggressiveAchievableYear: null,
    aggressiveAchievableYears: null,
    rows: tableRows,
    chartEndYear,
    portfolioPoints,
    safePoints: [],
    aggressivePoints: [],
  };
}
