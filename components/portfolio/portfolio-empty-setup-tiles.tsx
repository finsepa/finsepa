"use client";

import type { ReactNode } from "react";
import { Landmark, Layers2, LineChart, Pencil, Upload } from "@/lib/icons";

import { CARD_CHROME_CLASS } from "@/components/design-system/card-surface-styles";
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
  onClick?: () => void;
};

const nestedTileClass = cn(
  "flex flex-col items-start gap-3 rounded-2xl p-4 text-left",
  "bg-surface-subtle",
  CARD_CHROME_CLASS,
);

/**
 * Empty portfolio setup — four onboarding paths when the ledger has no transactions.
 */
export function PortfolioEmptySetupTiles({ className }: { className?: string }) {
  const {
    openCreatePortfolio,
    openNewTransaction,
    openImportTransactions,
    selectedPortfolioReadOnly,
  } = usePortfolioWorkspace();

  const tiles: SetupTile[] = [
    {
      id: "brokerage",
      title: "Connect brokerage",
      description: "Link an account via SnapTrade — new trades sync automatically.",
      icon: <Landmark className="size-5" strokeWidth={1.75} aria-hidden />,
      onClick: () => openCreatePortfolio({ mode: "brokerage" }),
    },
    {
      id: "manual",
      title: "Add manual transactions",
      description: "Log buys, sells, and cash movements yourself.",
      icon: <Pencil className="size-5" strokeWidth={1.75} aria-hidden />,
      disabled: selectedPortfolioReadOnly,
      onClick: () => openNewTransaction(),
    },
    {
      id: "import",
      title: "Import CSV File",
      description: "Drop in a broker export or your own trade spreadsheet.",
      icon: <Upload className="size-5" strokeWidth={1.75} aria-hidden />,
      disabled: selectedPortfolioReadOnly,
      onClick: () => openImportTransactions(),
    },
    {
      id: "demo",
      title: "Try a demo portfolio",
      description: "Explore with sample holdings before adding your own.",
      icon: <Layers2 className="size-5" strokeWidth={1.75} aria-hidden />,
      disabled: true,
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
        <EmptyTitle>To get started, choose how you want to add your investments</EmptyTitle>
        <EmptyDescription>
          Connect a brokerage, log trades by hand, or import a CSV.
        </EmptyDescription>
      </EmptyHeader>

      <EmptyContent className="mt-8 w-full max-w-none">
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {tiles.map((tile) => {
            const isDisabled = Boolean(tile.disabled);
            const content = (
              <>
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-[10px]",
                    "bg-surface text-icon",
                  )}
                  aria-hidden
                >
                  {tile.icon}
                </span>
                <span className="text-[15px] font-semibold leading-6 text-fg sm:text-base">
                  {tile.title}
                </span>
                <span className="text-[13px] font-normal leading-5 text-fg-muted sm:text-sm">
                  {tile.description}
                </span>
              </>
            );

            if (isDisabled) {
              return (
                <div
                  key={tile.id}
                  className={cn(nestedTileClass, "cursor-not-allowed select-none opacity-55")}
                  aria-disabled="true"
                  title="Coming soon"
                >
                  {content}
                </div>
              );
            }

            return (
              <button
                key={tile.id}
                type="button"
                onClick={tile.onClick}
                className={cn(
                  nestedTileClass,
                  "transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/15 focus-visible:ring-offset-2 focus-visible:ring-offset-panel",
                )}
              >
                {content}
              </button>
            );
          })}
        </div>
      </EmptyContent>
    </Empty>
  );
}
