"use client";

import type { PortfolioEntry } from "@/components/portfolio/portfolio-types";
import { AppCheckbox } from "@/components/ui/app-checkbox";
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
                "flex cursor-pointer items-center gap-3 px-4 py-3 text-sm text-[#0F0F0F] transition-colors",
                on ? "bg-white" : "hover:bg-[#F4F4F5]",
              )}
            >
              <AppCheckbox
                checked={on}
                onChange={() => onToggle(p.id)}
                aria-label={`Include ${p.name}`}
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
