"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { UserRound } from "@/lib/icons";

import { TabSwitcher, type TabSwitcherOption } from "@/components/design-system";
import { SuperinvestorsFundCards } from "@/components/superinvestors/superinvestors-fund-cards";
import type { SuperinvestorsFundRowModel } from "@/components/superinvestors/superinvestors-fund-table";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useSuperinvestorFollow } from "@/lib/superinvestors/use-superinvestor-follow";

type SuperinvestorsListView = "all" | "following";

const LIST_VIEW_OPTIONS: readonly TabSwitcherOption<SuperinvestorsListView>[] = [
  { value: "all", label: "All" },
  { value: "following", label: "Following" },
];

type ListViewContextValue = {
  view: SuperinvestorsListView;
  setView: (view: SuperinvestorsListView) => void;
};

const SuperinvestorsListViewContext = createContext<ListViewContextValue | null>(null);

function useSuperinvestorsListView() {
  const ctx = useContext(SuperinvestorsListViewContext);
  if (!ctx) throw new Error("SuperinvestorsListViewContext missing");
  return ctx;
}

/** Title + All/Following tabs — renders immediately while table data streams in. */
export function SuperinvestorsPageShell({ children }: { children: ReactNode }) {
  const [view, setView] = useState<SuperinvestorsListView>("all");

  return (
    <SuperinvestorsListViewContext.Provider value={{ view, setView }}>
      <div className="min-w-0 px-4 py-4 sm:px-9 sm:py-6">
        <div className="mb-6 flex flex-col gap-4 border-b border-stroke-subtle pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 max-w-3xl">
            <h1 className="hidden text-[28px] font-semibold leading-9 tracking-tight text-fg md:block">
              Superinvestors
            </h1>
            <p className="text-[14px] leading-6 text-fg-muted md:mt-2">
              Track what the world&apos;s best-known investors own. Each portfolio is rebuilt from the fund&apos;s latest
              SEC 13F filing: holdings, position sizing and value, updated as new filings land.
            </p>
          </div>
          <TabSwitcher
            options={LIST_VIEW_OPTIONS}
            value={view}
            onChange={setView}
            aria-label="Superinvestors list"
            className="w-auto shrink-0 self-start sm:self-end"
          />
        </div>
        {children}
      </div>
    </SuperinvestorsListViewContext.Provider>
  );
}

export function SuperinvestorsFundTableSection({ rows }: { rows: SuperinvestorsFundRowModel[] }) {
  const { view } = useSuperinvestorsListView();
  const { followed, hydrated, loaded, isFollowing } = useSuperinvestorFollow();

  const visibleRows = useMemo(() => {
    if (view === "all") return rows;
    // Wait for server sync when signed in so localStorage leftovers (e.g. Buffett) don't flash.
    if (!hydrated || !loaded) return [];
    return rows.filter((r) => isFollowing(r.href));
  }, [view, rows, hydrated, loaded, isFollowing, followed]);

  if (view === "following" && hydrated && loaded && visibleRows.length === 0) {
    return (
      <Empty variant="card" className="min-h-[min(40vh,320px)]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <UserRound className="h-6 w-6" strokeWidth={1.75} aria-hidden />
          </EmptyMedia>
          <EmptyTitle>No followed superinvestors</EmptyTitle>
          <EmptyDescription>
            Open a fund profile and tap Follow to see it here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return <SuperinvestorsFundCards rows={visibleRows} showFeatured={view === "all"} />;
}
