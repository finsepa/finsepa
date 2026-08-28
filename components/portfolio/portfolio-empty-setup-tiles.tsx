"use client";

import type { ReactNode } from "react";
import { Landmark, Layers2, LineChart, Pencil, Upload, Wallet } from "@/lib/icons";

import { whiteSurfaceButtonChromeClass } from "@/components/design-system/secondary-button-styles";
import { usePlanAccessOptional } from "@/components/account/plan-access-provider";
import { ProFeatureBadge } from "@/components/account/pro-feature-badge";
import { portfolioIsDemo } from "@/components/portfolio/portfolio-types";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

type SetupTile = {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  disabled?: boolean;
  showProBadge?: boolean;
  onClick?: () => void;
};

const setupTileButtonClass = cn(
  "flex w-full items-center gap-3 rounded-[10px] p-3 text-left",
  whiteSurfaceButtonChromeClass,
  "transition-colors duration-100 hover:bg-surface-muted dark:hover:bg-dropdown-item-hover",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/15 focus-visible:ring-offset-2 focus-visible:ring-offset-panel",
);

function SetupTileContent({ tile }: { tile: SetupTile }) {
  return (
    <>
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-[10px]",
          "bg-surface-muted text-icon",
        )}
        aria-hidden
      >
        {tile.icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="inline-flex flex-wrap items-center gap-1.5 text-[15px] font-semibold leading-6 text-fg sm:text-base">
          {tile.title}
          {tile.showProBadge ? (
            <ProFeatureBadge label="Brokerage sync is available on Pro only" />
          ) : null}
        </span>
        <span className="text-[13px] font-normal leading-5 text-fg-muted sm:text-sm">
          {tile.description}
        </span>
      </span>
    </>
  );
}

/**
 * Empty portfolio setup — four onboarding paths when the ledger has no transactions.
 */
export function PortfolioEmptySetupTiles({ className }: { className?: string }) {
  const {
    portfolios,
    openConnectBrokerageToSelected,
    openNewTransaction,
    openImportTransactions,
    openAddCash,
    openTryDemoPortfolio,
    selectedPortfolioReadOnly,
  } = usePortfolioWorkspace();
  const plan = usePlanAccessOptional();
  const canBrokerage = plan?.canConnectBrokerage !== false;
  const hasExistingDemoPortfolio = portfolios.some((p) => portfolioIsDemo(p));

  const tiles: SetupTile[] = [
    {
      id: "brokerage",
      title: "Connect brokerage",
      description: canBrokerage
        ? "Link your broker — we'll keep it synced."
        : "Connect your broker and stay synced.",
      icon: <Landmark className="size-5" strokeWidth={1.75} aria-hidden />,
      showProBadge: !canBrokerage,
      onClick: () => openConnectBrokerageToSelected(),
    },
    {
      id: "manual",
      title: "Add manual transactions",
      description: "Add trades and cash yourself.",
      icon: <Pencil className="size-5" strokeWidth={1.75} aria-hidden />,
      disabled: selectedPortfolioReadOnly,
      onClick: () => openNewTransaction(),
    },
    {
      id: "cash",
      title: "Manage cash",
      description: "Add or adjust your cash balance.",
      icon: <Wallet className="size-5" strokeWidth={1.75} aria-hidden />,
      disabled: selectedPortfolioReadOnly,
      onClick: () => openAddCash(),
    },
    ...(hasExistingDemoPortfolio
      ? []
      : [
          {
            id: "demo",
            title: "Try demo portfolio",
            description: "Explore with sample holdings.",
            icon: <Layers2 className="size-5" strokeWidth={1.75} aria-hidden />,
            onClick: () => openTryDemoPortfolio(),
          } satisfies SetupTile,
        ]),
    {
      id: "import",
      title: "Import CSV File",
      description: "Upload a CSV from your broker.",
      icon: <Upload className="size-5" strokeWidth={1.75} aria-hidden />,
      disabled: selectedPortfolioReadOnly,
      onClick: () => openImportTransactions(),
    },
  ];

  return (
    <Empty
      variant="card"
      className={cn(
        "min-h-[min(50vh,440px)] items-stretch justify-start px-4 py-10 text-left sm:px-6 sm:py-12",
        className,
      )}
    >
      <EmptyHeader className="mx-auto w-full max-w-lg items-center text-center">
        <EmptyMedia variant="icon">
          <LineChart className="h-6 w-6" strokeWidth={1.75} aria-hidden />
        </EmptyMedia>
        <EmptyTitle>Add your investments</EmptyTitle>
        <EmptyDescription>
          See performance, allocation, and returns in one place.
        </EmptyDescription>
      </EmptyHeader>

      <EmptyContent className="mx-auto mt-8 w-full max-w-lg">
        <div className="flex w-full flex-col gap-3">
          {tiles.map((tile) => {
            const isDisabled = Boolean(tile.disabled);

            if (isDisabled) {
              return (
                <div
                  key={tile.id}
                  className={cn(setupTileButtonClass, "cursor-not-allowed select-none opacity-55 hover:bg-button dark:hover:bg-button")}
                  aria-disabled="true"
                  title="Coming soon"
                >
                  <SetupTileContent tile={tile} />
                </div>
              );
            }

            return (
              <button
                key={tile.id}
                type="button"
                onClick={tile.onClick}
                className={setupTileButtonClass}
              >
                <SetupTileContent tile={tile} />
              </button>
            );
          })}
        </div>
      </EmptyContent>
    </Empty>
  );
}
