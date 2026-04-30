"use client";

import type { PortfolioEntry } from "@/components/portfolio/portfolio-types";
import { cn } from "@/lib/utils";

export function CombinedPortfolioSourcesPicker({
  standardPortfolios,
  picked,
  onToggle,
}: {
  standardPortfolios: PortfolioEntry[];
  picked: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  if (standardPortfolios.length < 2) {
    return <p className="mt-2 text-sm text-[#71717A]">Create another standard portfolio first.</p>;
  }

  return (
    <ul className="mt-2 divide-y divide-[#E4E4E7] rounded-[10px] border border-[#E4E4E7] bg-[#FAFAFA]">
      {standardPortfolios.map((p) => {
        const on = !!picked[p.id];
        return (
          <li key={p.id}>
            <label
              className={cn(
                "flex cursor-pointer items-center gap-3 px-4 py-3 text-sm text-[#09090B] transition-colors",
                on ? "bg-white" : "hover:bg-[#F4F4F5]",
              )}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => onToggle(p.id)}
                className="h-4 w-4 shrink-0 rounded border-[#E4E4E7] text-[#09090B] focus:ring-2 focus:ring-[#09090B]/15"
              />
              <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

export function CombinedPortfolioSourceHint() {
  return (
    <p className="text-xs leading-4 text-[#71717A]">
      Choose at least two standard portfolios. Combined portfolios are read-only — trades and cash are managed in each
      source portfolio.
    </p>
  );
}
