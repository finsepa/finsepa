"use client";

import { useMemo } from "react";

import { AllocationDonutChart } from "@/components/portfolio/allocation-donut-chart";
import { SuperinvestorProfileAvatar } from "@/components/superinvestors/superinvestor-profile-avatar";
import { buildTopNAllocationRows } from "@/lib/portfolio/allocation-donut-rows";
import type { Berkshire13fComparisonRow } from "@/lib/superinvestors/types";

export function SuperinvestorProfileAllocationDonut({
  rows,
  avatarSrc,
  profileName,
}: {
  rows: Berkshire13fComparisonRow[];
  avatarSrc?: string | null;
  profileName: string;
}) {
  const allocRows = useMemo(() => {
    const raw = rows
      .filter((r) => r.weight > 0 && Number.isFinite(r.weight))
      .map((r) => {
        const ticker = r.ticker?.trim().toUpperCase() ?? "";
        return {
          id: `${r.cusip ?? ""}-${ticker || r.companyName}`,
          name: r.companyName,
          symbol: ticker || r.companyName,
          weightPct: r.weight,
        };
      });
    return buildTopNAllocationRows(raw);
  }, [rows]);

  if (allocRows.length === 0) return null;

  return (
    <AllocationDonutChart
      rows={allocRows}
      className="size-[176px]"
      chartSizePx={176}
      center={
        <SuperinvestorProfileAvatar
          src={avatarSrc?.trim() ?? ""}
          name={profileName}
          size="donut"
        />
      }
    />
  );
}
