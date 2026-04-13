"use client";

import { memo, useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";

import { avatarUrlFromUser, initialsFromUser } from "@/lib/auth/user-display";
import { UserAvatar } from "@/components/user/user-avatar";
import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { netCashUsd, totalNetWorth } from "@/lib/portfolio/overview-metrics";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const pct1 = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Distinct colors for allocation dots (cycles if there are many positions). */
const PALETTE = [
  "#2563EB",
  "#DC2626",
  "#9333EA",
  "#EA580C",
  "#16A34A",
  "#CA8A04",
  "#B91C1C",
  "#64748B",
  "#0891B2",
  "#DB2777",
  "#4F46E5",
  "#65A30D",
] as const;

const VB = 100;
const CX = 50;
const CY = 50;
/** Thinner ring: outer ~48, inner ~42.5 → ~5.5 units thick (~12px at 220px). */
const R_OUT = 48;
const R_IN = 42.5;

type AllocRow = { id: string; name: string; weightPct: number; color: string };

function buildRows(holdings: PortfolioHolding[], transactions: PortfolioTransaction[]): AllocRow[] {
  const cashUsd = netCashUsd(transactions);
  const netWorth = totalNetWorth(holdings, cashUsd);
  if (netWorth <= 0) return [];

  const raw: { id: string; name: string; weightPct: number }[] = holdings.map((h) => ({
    id: h.id,
    name: h.name.trim() || h.symbol,
    weightPct: (h.currentValue / netWorth) * 100,
  }));

  raw.push({
    id: "cash-usd",
    name: "US Dollar",
    weightPct: (cashUsd / netWorth) * 100,
  });

  raw.sort((a, b) => b.weightPct - a.weightPct);

  return raw.map((r, i) => ({
    ...r,
    color: PALETTE[i % PALETTE.length]!,
  }));
}

function polar(cx: number, cy: number, r: number, angleRad: number) {
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

/** Annular sector: angles in radians, sweep clockwise from a0 to a1 (a1 > a0). */
function donutSlicePath(cx: number, cy: number, rOuter: number, rInner: number, a0: number, a1: number) {
  const p0o = polar(cx, cy, rOuter, a0);
  const p1o = polar(cx, cy, rOuter, a1);
  const p1i = polar(cx, cy, rInner, a1);
  const p0i = polar(cx, cy, rInner, a0);
  const sweep = a1 - a0;
  const largeArc = sweep > Math.PI ? 1 : 0;
  return [
    `M ${p0o.x} ${p0o.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p1o.x} ${p1o.y}`,
    `L ${p1i.x} ${p1i.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${p0i.x} ${p0i.y}`,
    "Z",
  ].join(" ");
}

/** Full ring (single 100% slice): SVG arcs cannot do 360° in one command — use stroke ring. */
function FullRing({ color }: { color: string }) {
  const mid = (R_OUT + R_IN) / 2;
  const sw = R_OUT - R_IN;
  return (
    <circle
      cx={CX}
      cy={CY}
      r={mid}
      fill="none"
      stroke={color}
      strokeWidth={sw}
    />
  );
}

function useAllocationCenterAvatar() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [initials, setInitials] = useState("?");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data } = await supabase.auth.getUser();
        const u = data.user;
        if (cancelled || !u) return;
        setImageSrc(avatarUrlFromUser(u));
        setInitials(initialsFromUser(u));
      } catch {
        if (!cancelled) setImageSrc(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { imageSrc, initials };
}

function AllocationColumn({ rows }: { rows: AllocRow[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.id} className="flex min-w-0 items-center gap-3">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: r.color }}
            aria-hidden
          />
          <span className="min-w-0 flex-1 truncate text-left text-[14px] leading-5 text-[#09090B]">
            {r.name}
          </span>
          <span className="shrink-0 tabular-nums text-[14px] font-medium leading-5 text-[#09090B]">
            {pct1.format(r.weightPct)}%
          </span>
        </li>
      ))}
    </ul>
  );
}

type TooltipState = { name: string; pctLabel: string; x: number; y: number } | null;

function AllocationDonut({
  rows,
  onTooltipChange,
}: {
  rows: AllocRow[];
  onTooltipChange: (t: TooltipState) => void;
}) {
  const [dimIndex, setDimIndex] = useState<number | null>(null);

  const slices = useMemo(() => {
    const prefix: number[] = [];
    let cum = 0;
    for (const row of rows) {
      prefix.push(cum);
      cum += row.weightPct;
    }
    return rows.map((row, i) => {
      const start = prefix[i] ?? 0;
      const end = start + row.weightPct;
      const a0 = -Math.PI / 2 + (start / 100) * 2 * Math.PI;
      const a1 = -Math.PI / 2 + (end / 100) * 2 * Math.PI;
      return { row, i, a0, a1 };
    });
  }, [rows]);

  const moveTip = useCallback(
    (e: MouseEvent, row: AllocRow) => {
      onTooltipChange({
        name: row.name,
        pctLabel: `${pct1.format(row.weightPct)}%`,
        x: e.clientX,
        y: e.clientY,
      });
    },
    [onTooltipChange],
  );

  const leave = useCallback(() => {
    setDimIndex(null);
    onTooltipChange(null);
  }, [onTooltipChange]);

  if (rows.length === 1) {
    const row = rows[0]!;
    return (
      <svg
        viewBox={`0 0 ${VB} ${VB}`}
        className="h-full w-full touch-none"
        onMouseLeave={leave}
      >
        <g
          onMouseEnter={(e) => {
            setDimIndex(0);
            moveTip(e, row);
          }}
          onMouseMove={(e) => moveTip(e, row)}
          onMouseLeave={leave}
          className="cursor-pointer"
        >
          <FullRing color={row.color} />
          <title>
            {row.name} {pct1.format(row.weightPct)}%
          </title>
        </g>
      </svg>
    );
  }

  return (
    <svg viewBox={`0 0 ${VB} ${VB}`} className="h-full w-full touch-none" onMouseLeave={leave}>
      {slices.map(({ row, i, a0, a1 }) => (
        <path
          key={row.id}
          d={donutSlicePath(CX, CY, R_OUT, R_IN, a0, a1)}
          fill={row.color}
          stroke="none"
          className="cursor-pointer transition-[opacity] duration-150"
          style={{
            opacity: dimIndex !== null && dimIndex !== i ? 0.45 : 1,
          }}
          onMouseEnter={(e) => {
            setDimIndex(i);
            moveTip(e, row);
          }}
          onMouseMove={(e) => moveTip(e, row)}
          onMouseLeave={leave}
        >
          <title>
            {row.name} {pct1.format(row.weightPct)}%
          </title>
        </path>
      ))}
    </svg>
  );
}

function PortfolioAllocationViewInner({
  holdings,
  transactions,
}: {
  holdings: PortfolioHolding[];
  transactions: PortfolioTransaction[];
}) {
  const rows = useMemo(() => buildRows(holdings, transactions), [holdings, transactions]);
  const { imageSrc, initials } = useAllocationCenterAvatar();
  const [tooltip, setTooltip] = useState<TooltipState>(null);

  const { left, right } = useMemo(() => {
    const mid = Math.ceil(rows.length / 2);
    return { left: rows.slice(0, mid), right: rows.slice(mid) };
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div className="rounded-[12px] border border-[#E4E4E7] bg-white px-6 py-12 text-center text-sm text-[#71717A]">
        No allocation to display.
      </div>
    );
  }

  return (
    <div className="rounded-[12px] border border-[#E4E4E7] bg-white px-6 py-5 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)]">
      {tooltip ? (
        <div
          className="pointer-events-none fixed z-[200] max-w-[min(calc(100vw-1rem),280px)] rounded-lg border border-[#E4E4E7] bg-white px-3 py-2 text-left shadow-[0px_4px_12px_0px_rgba(10,10,10,0.08)]"
          style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
        >
          <div className="text-[13px] font-semibold leading-5 text-[#09090B]">{tooltip.name}</div>
          <div className="text-[12px] tabular-nums leading-4 text-[#71717A]">{tooltip.pctLabel}</div>
        </div>
      ) : null}

      <div className="flex flex-col items-stretch gap-8 lg:flex-row lg:items-center lg:gap-10">
        <div className="relative mx-auto h-[220px] w-[220px] shrink-0">
          <div className="absolute inset-0" aria-hidden>
            <AllocationDonut rows={rows} onTooltipChange={setTooltip} />
          </div>
          <div className="pointer-events-none relative z-10 flex h-full w-full items-center justify-center">
            <UserAvatar imageSrc={imageSrc} initials={initials} size="xl" />
          </div>
        </div>

        <div className="mx-auto grid min-w-0 max-w-4xl flex-1 grid-cols-1 gap-8 sm:grid-cols-2 sm:gap-x-12">
          <AllocationColumn rows={left} />
          <AllocationColumn rows={right} />
        </div>
      </div>
    </div>
  );
}

export const PortfolioAllocationView = memo(PortfolioAllocationViewInner);
