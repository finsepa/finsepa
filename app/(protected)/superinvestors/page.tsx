import { Suspense } from "react";

import {
  SuperinvestorsFundTableSection,
  SuperinvestorsPageShell,
} from "@/components/superinvestors/superinvestors-page-client";
import { SuperinvestorsFundTableSkeleton } from "@/components/superinvestors/superinvestors-fund-table-skeleton";
import { loadSuperinvestorsListRows } from "@/lib/superinvestors/load-superinvestors-list-rows";

export const dynamic = "force-dynamic";

async function SuperinvestorsListTable() {
  const rows = await loadSuperinvestorsListRows();
  return <SuperinvestorsFundTableSection rows={rows} />;
}

export default function SuperinvestorsPage() {
  return (
    <SuperinvestorsPageShell>
      <Suspense fallback={<SuperinvestorsFundTableSkeleton />}>
        <SuperinvestorsListTable />
      </Suspense>
    </SuperinvestorsPageShell>
  );
}
