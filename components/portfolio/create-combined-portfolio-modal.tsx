"use client";

import { useId, useMemo, useState } from "react";
import { X } from "lucide-react";

import { ClearableInput } from "@/components/layout/clearable-input";
import type { PortfolioEntry } from "@/components/portfolio/portfolio-types";
import { cn } from "@/lib/utils";

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-2">
      <span className="text-sm font-medium leading-5 text-[#09090B]">{label}</span>
      {children}
    </div>
  );
}

export function CreateCombinedPortfolioModal({
  portfolios,
  onClose,
  onAdd,
}: {
  portfolios: PortfolioEntry[];
  onClose: () => void;
  onAdd: (name: string, sourcePortfolioIds: string[]) => void;
}) {
  const titleId = useId();
  const [name, setName] = useState("Combined portfolio");
  const [picked, setPicked] = useState<Record<string, boolean>>({});

  const standardPortfolios = useMemo(
    () => portfolios.filter((p) => p.kind !== "combined"),
    [portfolios],
  );

  const selectedIds = useMemo(
    () => standardPortfolios.filter((p) => picked[p.id]).map((p) => p.id),
    [standardPortfolios, picked],
  );

  const canAdd = name.trim().length > 0 && selectedIds.length >= 2;

  function toggle(id: string) {
    setPicked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[min(90vh,640px)] w-full max-w-[480px] flex-col rounded-xl bg-white shadow-[0px_10px_16px_-3px_rgba(10,10,10,0.1),0px_4px_6px_0px_rgba(10,10,10,0.04)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#E4E4E7] px-5 py-3">
          <h2 id={titleId} className="text-lg font-semibold leading-7 tracking-tight text-[#09090B]">
            Create combined portfolio
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[#09090B] transition-colors hover:bg-[#F4F4F5]"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-5 pt-5">
          <ModalField label="Name">
            <ClearableInput
              type="text"
              value={name}
              onChange={setName}
              placeholder="Combined portfolio"
              clearLabel="Clear name"
            />
          </ModalField>

          <ModalField label="Portfolios to include">
            <p className="text-xs leading-4 text-[#71717A]">
              Choose at least two standard portfolios. Combined portfolios are read-only — trades and cash are
              managed in each source portfolio.
            </p>
            {standardPortfolios.length < 2 ? (
              <p className="mt-2 text-sm text-[#71717A]">Create another standard portfolio first.</p>
            ) : (
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
                          onChange={() => toggle(p.id)}
                          className="h-4 w-4 shrink-0 rounded border-[#E4E4E7] text-[#09090B] focus:ring-2 focus:ring-[#09090B]/15"
                        />
                        <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </ModalField>
        </div>

        <div className="flex shrink-0 gap-3 border-t border-[#E4E4E7] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-9 flex-1 items-center justify-center rounded-[10px] bg-[#F4F4F5] px-4 py-2 text-sm font-medium text-[#09090B] transition-colors hover:bg-[#EBEBEB]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canAdd}
            onClick={() => onAdd(name.trim(), selectedIds)}
            className={cn(
              "flex min-h-9 flex-1 items-center justify-center rounded-[10px] px-4 py-2 text-sm font-medium text-white transition-colors",
              canAdd
                ? "bg-[#09090B] hover:bg-[#27272A]"
                : "cursor-not-allowed bg-[#A1A1AA] opacity-50",
            )}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
