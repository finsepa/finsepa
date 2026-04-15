import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { format, isValid, parseISO } from "date-fns";

import { Berkshire13fComparisonTable } from "@/components/superinvestors/berkshire-13f-comparison-table";
import { getBerkshireHoldingsComparison } from "@/lib/superinvestors/berkshire-13f";
import { formatUsdCompact } from "@/lib/market/key-stats-basic-format";

export const dynamic = "force-dynamic";

function formatLastUpdatedLabel(ymd: string | null): string {
  if (!ymd?.trim()) return "—";
  const d = parseISO(ymd.trim());
  if (!isValid(d)) return ymd.trim();
  return format(d, "d MMM yyyy");
}

export default async function BerkshireHathaway13fPage() {
  const data = await getBerkshireHoldingsComparison();

  return (
    <div className="px-9 py-6">
      <nav aria-label="Breadcrumb" className="flex items-center">
        <div className="flex items-center gap-1 text-[14px] text-[#71717A]">
          <Link href="/superinvestors" className="transition-colors hover:text-[#09090B]">
            Superinvestors
          </Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="font-medium text-[#09090B]" aria-current="page">
            Warren Buffett
          </span>
        </div>
      </nav>

      <header className="mt-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[#09090B]">{data.filerDisplayName}</h1>
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div>
            <dt className="text-[#71717A]">Size</dt>
            <dd className="font-semibold tabular-nums text-[#09090B]">{formatUsdCompact(data.totalValueUsd)}</dd>
          </div>
          <div>
            <dt className="text-[#71717A]">No. of stocks</dt>
            <dd className="font-semibold tabular-nums text-[#09090B]">
              {data.positionCount.toLocaleString("en-US")}{" "}
              {data.positionCount === 1 ? "Stock" : "Stocks"}
            </dd>
          </div>
          <div>
            <dt className="text-[#71717A]">Last updated</dt>
            <dd className="font-semibold text-[#09090B]">{formatLastUpdatedLabel(data.current.filingDate)}</dd>
          </div>
        </dl>
      </header>

      {!data.hasPriorFiling ? (
        <p className="mt-4 max-w-3xl text-sm text-[#71717A]">
          Only one 13F-HR filing appears in the SEC feed; change badges and prior columns are hidden until a second
          filing is available.
        </p>
      ) : null}

      <div className="mt-8">
        <Berkshire13fComparisonTable
          rows={data.rows}
          soldOut={data.soldOut}
          hasPriorFiling={data.hasPriorFiling}
        />
      </div>
    </div>
  );
}
