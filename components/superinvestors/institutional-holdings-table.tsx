"use client";

import { memo } from "react";

import type { InstitutionalHoldingRow } from "@/lib/superinvestors/types";
import { cn } from "@/lib/utils";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

const pct = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function InstitutionalHoldingsTableInner({
  holdings,
  className,
}: {
  holdings: InstitutionalHoldingRow[];
  className?: string;
}) {
  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-stroke text-fg-muted">
            <th className="pb-3 pr-4 text-left font-medium">Issuer</th>
            <th className="whitespace-nowrap pb-3 pr-4 text-left font-medium">Class</th>
            <th className="whitespace-nowrap pb-3 pr-4 text-right font-medium">Value</th>
            <th className="whitespace-nowrap pb-3 pr-0 text-right font-medium">% of portfolio</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h, i) => (
            <tr key={`${h.issuer}-${i}`} className="border-b border-stroke">
              <td className="py-3 pr-4 align-middle font-medium text-fg">{h.issuer}</td>
              <td className="py-3 pr-4 align-middle text-fg-muted">{h.titleOfClass ?? "—"}</td>
              <td className="whitespace-nowrap py-3 pr-4 text-right align-middle tabular-nums text-fg">
                {usd.format(h.valueUsd)}
              </td>
              <td className="whitespace-nowrap py-3 pr-0 text-right align-middle tabular-nums text-fg">
                {pct.format(h.pct)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const InstitutionalHoldingsTable = memo(InstitutionalHoldingsTableInner);
