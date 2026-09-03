"use client";

import { Flag01, Pencil } from "@/lib/icons";
import { useCallback, useMemo, useState, type ReactNode } from "react";

import { MOBILE_ELEVATED_CARD_CLASS } from "@/components/design-system/card-surface-styles";
import { secondaryFillButtonClassName, secondaryOutlineButtonClassName } from "@/components/design-system/secondary-button-styles";
import { PortfolioGoalModal } from "@/components/portfolio/portfolio-goal-modal";
import { PortfolioGoalProgressBar } from "@/components/portfolio/portfolio-goal-progress-bar";
import {
  GoalScenarioLegendBadge,
  PortfolioGoalProjectionChart,
} from "@/components/portfolio/portfolio-goal-projection-chart";
import { PortfolioGoalResultsTable } from "@/components/portfolio/portfolio-goal-results-table";
import { PortfolioHoldingsSubTabMobileCard } from "@/components/portfolio/portfolio-holdings-sub-tab-mobile-card";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import type { PortfolioGoal, PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  computePortfolioGoalProjection,
  computePortfolioPassiveIncomeProjection,
  portfolioGoalAggressiveReturnPct,
  portfolioGoalDividendGrowthPct,
  portfolioGoalDividendYieldPct,
  portfolioGoalNormalReturnPct,
  portfolioGoalSafeReturnPct,
} from "@/lib/portfolio/portfolio-goal-projections";
import { resolveFsColor } from "@/lib/theme/resolve-fs-color";
import { usePortfolioDividendAnnualUsd } from "@/lib/portfolio/use-portfolio-dividend-annual-usd";
import { usePortfolioAverageAnnualReturnPct } from "@/lib/portfolio/use-portfolio-average-annual-return-pct";
import { formatUsdCompact } from "@/lib/market/key-stats-basic-format";
import { netCashUsd, totalNetWorth } from "@/lib/portfolio/overview-metrics";
import { cn } from "@/lib/utils";

const NORMAL_SCENARIO_LABEL = "Normal";
const SAFE_SCENARIO_SWATCH = "#9333EA";
const SAFE_SCENARIO_LABEL = "Safe";
const AGGRESSIVE_SCENARIO_SWATCH = "#EA580C";
const AGGRESSIVE_SCENARIO_LABEL = "Aggressive";

const GOAL_METRIC_CARD_CLASS = cn(
  "flex flex-col items-start gap-1 overflow-hidden p-4",
  MOBILE_ELEVATED_CARD_CLASS,
);

const GOAL_USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function goalReturnPctLabel(goal: PortfolioGoal): string {
  return formatGoalReturnPct(portfolioGoalNormalReturnPct(goal));
}

function formatGoalReturnPct(pct: number): string {
  return `${new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(pct)}%`;
}

function goalScenarioLegendLabel(name: string, pct: number): string {
  return `${name}: ${formatGoalReturnPct(pct)}`;
}

function GoalSettingBadge({ children }: { children: ReactNode }) {
  return (
    <span className={cn(secondaryFillButtonClassName, "pointer-events-none tabular-nums")}>
      {children}
    </span>
  );
}

function GoalProjectionConfigBadges({
  goal,
  currentYieldPct,
}: {
  goal: PortfolioGoal;
  currentYieldPct: number | null;
}) {
  if (goal.kind === "passive_income") {
    return (
      <>
        <GoalSettingBadge>Target: {GOAL_USD.format(goal.targetUsd)}</GoalSettingBadge>
        <GoalSettingBadge>
          Yield: {formatGoalReturnPct(portfolioGoalDividendYieldPct(goal, currentYieldPct))}
        </GoalSettingBadge>
        <GoalSettingBadge>
          Growth: {formatGoalReturnPct(portfolioGoalDividendGrowthPct(goal))}
        </GoalSettingBadge>
        <GoalSettingBadge>
          Contribution:{" "}
          {goal.monthlyContributionUsd > 0 ?
            `${GOAL_USD.format(goal.monthlyContributionUsd)} / m`
          : "No"}
        </GoalSettingBadge>
      </>
    );
  }
  return (
    <>
      <GoalSettingBadge>Value: {GOAL_USD.format(goal.targetUsd)}</GoalSettingBadge>
      <GoalSettingBadge>Return: {goalReturnPctLabel(goal)}</GoalSettingBadge>
      <GoalSettingBadge>
        Contribution:{" "}
        {goal.monthlyContributionUsd > 0 ?
          `${GOAL_USD.format(goal.monthlyContributionUsd)} / m`
        : "No"}
      </GoalSettingBadge>
      <GoalSettingBadge>Dividends reinvest: {goal.reinvestDividends ? "On" : "Off"}</GoalSettingBadge>
    </>
  );
}

export function PortfolioGoalPanel({
  holdings,
  transactions,
}: {
  holdings: PortfolioHolding[];
  transactions: PortfolioTransaction[];
}) {
  const {
    selectedPortfolioId,
    goalByPortfolioId,
    setPortfolioGoal,
  } = usePortfolioWorkspace();

  const goal = selectedPortfolioId != null ? goalByPortfolioId[selectedPortfolioId] : null;
  const [modalOpen, setModalOpen] = useState(false);

  const currentValue = useMemo(() => {
    const cash = netCashUsd(transactions);
    return totalNetWorth(holdings, cash);
  }, [holdings, transactions]);

  const dividendIncome = usePortfolioDividendAnnualUsd(holdings);
  const currentAnnualPassiveIncomeUsd = dividendIncome.annualUsd;
  const currentDividendYieldPct = dividendIncome.yieldPct;
  const shouldComputePortfolioReturn =
    goal == null || (goal.kind === "value" && goal.portfolioAnnualReturnPct == null);
  const portfolioAverageAnnualReturnPct = usePortfolioAverageAnnualReturnPct(transactions, shouldComputePortfolioReturn);

  const holdingsEquityUsd = useMemo(
    () => holdings.reduce((sum, h) => sum + (Number.isFinite(h.currentValue) ? h.currentValue : 0), 0),
    [holdings],
  );

  const projection = useMemo(() => {
    if (goal == null) return null;
    if (goal.kind === "passive_income") {
      return computePortfolioPassiveIncomeProjection(holdingsEquityUsd, goal, {
        currentYieldPct: currentDividendYieldPct,
        currentAnnualIncomeUsd: currentAnnualPassiveIncomeUsd,
      });
    }
    return computePortfolioGoalProjection(currentValue, goal, {
      annualDividendUsd: currentAnnualPassiveIncomeUsd,
    });
  }, [goal, currentValue, holdingsEquityUsd, currentAnnualPassiveIncomeUsd, currentDividendYieldPct]);

  const portfolioSwatch = resolveFsColor("--fs-accent");
  const [showNormal, setShowNormal] = useState(true);
  const [showSafe, setShowSafe] = useState(true);
  const [showAggressive, setShowAggressive] = useState(true);

  const toggleNormal = useCallback(() => {
    setShowNormal((cur) => {
      if (cur && !showSafe && !showAggressive) return cur;
      return !cur;
    });
  }, [showSafe, showAggressive]);

  const toggleSafe = useCallback(() => {
    setShowSafe((cur) => {
      if (cur && !showNormal && !showAggressive) return cur;
      return !cur;
    });
  }, [showNormal, showAggressive]);

  const toggleAggressive = useCallback(() => {
    setShowAggressive((cur) => {
      if (cur && !showNormal && !showSafe) return cur;
      return !cur;
    });
  }, [showNormal, showSafe]);

  const isIncomeGoal = goal?.kind === "passive_income";

  const chartSeries = useMemo(() => {
    if (!projection) return [];
    if (isIncomeGoal) {
      return [
        {
          id: "income",
          label: "Passive income",
          color: portfolioSwatch,
          points: projection.portfolioPoints,
          visible: true,
        },
      ];
    }
    return [
      {
        id: "safe",
        label: SAFE_SCENARIO_LABEL,
        color: SAFE_SCENARIO_SWATCH,
        points: projection.safePoints,
        visible: showSafe,
      },
      {
        id: "normal",
        label: NORMAL_SCENARIO_LABEL,
        color: portfolioSwatch,
        points: projection.portfolioPoints,
        visible: showNormal,
      },
      {
        id: "aggressive",
        label: AGGRESSIVE_SCENARIO_LABEL,
        color: AGGRESSIVE_SCENARIO_SWATCH,
        points: projection.aggressivePoints,
        visible: showAggressive,
      },
    ];
  }, [isIncomeGoal, portfolioSwatch, projection, showAggressive, showNormal, showSafe]);

  const openCreate = useCallback(() => setModalOpen(true), []);
  const openEdit = useCallback(() => setModalOpen(true), []);

  const handleSave = useCallback(
    (next: NonNullable<typeof goal>) => {
      if (selectedPortfolioId == null) return;
      setPortfolioGoal(selectedPortfolioId, next);
      setModalOpen(false);
    },
    [selectedPortfolioId, setPortfolioGoal],
  );

  if (goal == null) {
    return (
      <>
        <Empty variant="card" className="min-h-[min(48vh,420px)]">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Flag01 className="h-6 w-6" strokeWidth={1.75} aria-hidden />
            </EmptyMedia>
            <EmptyTitle>Set a portfolio goal</EmptyTitle>
            <EmptyDescription className="max-w-sm">
              Model how contributions and returns could grow your portfolio toward a target.
            </EmptyDescription>
            <button
              type="button"
              onClick={openCreate}
              className={cn(
                "mt-4 inline-flex min-h-9 items-center justify-center rounded-[10px] px-4 text-sm font-medium text-surface transition-colors",
                "bg-fg hover:bg-fg",
              )}
            >
              Create Goal
            </button>
          </EmptyHeader>
        </Empty>
        <PortfolioGoalModal
          key="create"
          open={modalOpen}
          initialGoal={null}
          currentPortfolioValue={currentValue}
          currentAnnualPassiveIncomeUsd={currentAnnualPassiveIncomeUsd}
          currentDividendYieldPct={currentDividendYieldPct}
          portfolioAverageAnnualReturnPct={portfolioAverageAnnualReturnPct}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        />
      </>
    );
  }

  const kindLabel = goal.kind === "passive_income" ? "Passive income annually" : "Value";
  const progressLabel =
    goal.kind === "passive_income"
      ? `${GOAL_USD.format(currentAnnualPassiveIncomeUsd ?? 0)} / ${GOAL_USD.format(goal.targetUsd)}`
      : `${formatUsdCompact(currentValue)} of ${formatUsdCompact(goal.targetUsd)}`;

  const achievableHeadline =
    projection?.achievableYears != null && projection.achievableYear != null
      ? `${projection.achievableYears} ${projection.achievableYears === 1 ? "Year" : "Years"}`
      : "50+ Years";
  const achievableSub =
    projection?.achievableYear != null ? `By ${projection.achievableYear}` : "Adjust your target or contributions";

  const progressPct = projection?.progressPct ?? 0;

  const aggressiveLegendLabel = goalScenarioLegendLabel(
    AGGRESSIVE_SCENARIO_LABEL,
    portfolioGoalAggressiveReturnPct(goal),
  );
  const normalLegendLabel = goalScenarioLegendLabel(
    NORMAL_SCENARIO_LABEL,
    portfolioGoalNormalReturnPct(goal),
  );
  const safeLegendLabel = goalScenarioLegendLabel(
    SAFE_SCENARIO_LABEL,
    portfolioGoalSafeReturnPct(),
  );

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-col gap-6">
      <div className="grid w-full min-w-0 grid-cols-2 gap-4 [&>*]:min-w-0">
        <div className={GOAL_METRIC_CARD_CLASS}>
          <p className="text-xs font-medium text-fg-muted">{kindLabel}</p>
          <p className="text-2xl font-semibold tabular-nums tracking-tight text-fg">{progressLabel}</p>
          <div className="mt-1 flex w-full min-w-0 items-center gap-2 self-stretch">
            <PortfolioGoalProgressBar className="min-w-0 flex-1" progressPct={progressPct} />
            <p className="shrink-0 text-sm text-fg-muted">{Math.round(progressPct)}%</p>
          </div>
        </div>
        <div className={GOAL_METRIC_CARD_CLASS}>
          <p className="text-xs font-medium text-fg-muted">Aiming to achieve in</p>
          <p className="text-2xl font-semibold tracking-tight text-fg">{achievableHeadline}</p>
          <p className="text-sm text-fg-muted">{achievableSub}</p>
        </div>
      </div>

      <section className="w-full min-w-0">
        <div className="mb-4 flex w-full min-w-0 items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <GoalProjectionConfigBadges goal={goal} currentYieldPct={currentDividendYieldPct} />
          </div>
          <button type="button" onClick={openEdit} className={cn(secondaryOutlineButtonClassName, "shrink-0")}>
            <Pencil className="size-4 shrink-0" strokeWidth={2} aria-hidden />
            Edit
          </button>
        </div>
        <PortfolioGoalProjectionChart series={chartSeries} targetUsd={goal.targetUsd} />
        {goal.kind === "passive_income" ? null : (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <GoalScenarioLegendBadge
              label={aggressiveLegendLabel}
              swatch={AGGRESSIVE_SCENARIO_SWATCH}
              pressed={showAggressive}
              onToggle={toggleAggressive}
            />
            <GoalScenarioLegendBadge
              label={normalLegendLabel}
              swatch={portfolioSwatch}
              pressed={showNormal}
              onToggle={toggleNormal}
            />
            <GoalScenarioLegendBadge
              label={safeLegendLabel}
              swatch={SAFE_SCENARIO_SWATCH}
              pressed={showSafe}
              onToggle={toggleSafe}
            />
          </div>
        )}
      </section>

      <section className="w-full min-w-0">
        <PortfolioHoldingsSubTabMobileCard>
          {projection ? (
            <PortfolioGoalResultsTable
              rows={projection.rows}
              targetUsd={goal.targetUsd}
              mode={goal.kind === "passive_income" ? "passive_income" : "value"}
            />
          ) : null}
        </PortfolioHoldingsSubTabMobileCard>
      </section>

      <PortfolioGoalModal
        key={`edit-${goal.kind}-${goal.targetUsd}-${goal.achieveByYear}-${goal.monthlyContributionUsd}-${goal.reinvestDividends}-${goal.portfolioAnnualReturnPct ?? ""}-${goal.dividendYieldPct ?? ""}-${goal.dividendGrowthPct ?? ""}`}
        open={modalOpen}
        initialGoal={goal}
        currentPortfolioValue={currentValue}
        currentAnnualPassiveIncomeUsd={currentAnnualPassiveIncomeUsd}
        currentDividendYieldPct={currentDividendYieldPct}
        portfolioAverageAnnualReturnPct={portfolioAverageAnnualReturnPct}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
