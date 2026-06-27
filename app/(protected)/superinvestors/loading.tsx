import { SuperinvestorsPageShell } from "@/components/superinvestors/superinvestors-page-client";
import { SuperinvestorsFundTableSkeleton } from "@/components/superinvestors/superinvestors-fund-table-skeleton";

export default function SuperinvestorsLoading() {
  return (
    <SuperinvestorsPageShell>
      <SuperinvestorsFundTableSkeleton />
    </SuperinvestorsPageShell>
  );
}
