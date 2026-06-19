"use client";

import { useMemo, useState } from "react";
import { UserRound } from "@/lib/icons";

import { TabSwitcher, type TabSwitcherOption } from "@/components/design-system";
import {
  SuperinvestorsFundTable,
  type SuperinvestorsFundRowModel,
} from "@/components/superinvestors/superinvestors-fund-table";
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

export function SuperinvestorsPageClient({ rows }: { rows: SuperinvestorsFundRowModel[] }) {
  const [view, setView] = useState<SuperinvestorsListView>("all");
  const { followed, hydrated, isFollowing } = useSuperinvestorFollow();

  const visibleRows = useMemo(() => {
    if (view === "all") return rows;
    if (!hydrated) return [];
    return rows.filter((r) => isFollowing(r.href));
  }, [view, rows, hydrated, isFollowing, followed]);

  return (
    <div className="min-w-0 px-4 py-4 sm:px-9 sm:py-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="hidden text-2xl font-semibold tracking-tight text-[#09090B] md:block">
          Superinvestors
        </h1>
        <TabSwitcher
          options={LIST_VIEW_OPTIONS}
          value={view}
          onChange={setView}
          aria-label="Superinvestors list"
        />
      </div>

      {view === "following" && hydrated && visibleRows.length === 0 ? (
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
      ) : (
        <SuperinvestorsFundTable rows={visibleRows} />
      )}
    </div>
  );
}
