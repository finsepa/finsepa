"use client";

import { useId, useMemo, useState } from "react";

import { ClearableInput } from "@/components/layout/clearable-input";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import {
  AppModalFooter,
  AppModalShell,
  appModalCancelButtonClass,
  appModalPrimaryButtonClass,
} from "@/components/ui/app-modal-shell";
import {
  CombinedPortfolioSourceHint,
  CombinedPortfolioSourcesPicker,
} from "@/components/portfolio/combined-portfolio-sources-picker";
import type { PortfolioEntry } from "@/components/portfolio/portfolio-types";

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-2">
      <span className="text-sm font-medium leading-5 text-[#0F0F0F]">{label}</span>
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
    <AppModalOverlay open onClose={onClose} zIndex={110}>
      <AppModalShell
        titleId={titleId}
        title="Create Combined Portfolio"
        onClose={onClose}
        maxHeightClass="max-h-[min(90vh,640px)]"
        bodyClassName="flex flex-col gap-4 px-5 pb-5 pt-5"
        footer={
          <AppModalFooter>
            <button type="button" onClick={onClose} className={appModalCancelButtonClass}>
              Cancel
            </button>
            <button
              type="button"
              disabled={!canAdd}
              onClick={() => onAdd(name.trim(), selectedIds)}
              className={appModalPrimaryButtonClass(canAdd)}
            >
              Add
            </button>
          </AppModalFooter>
        }
      >
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
          <CombinedPortfolioSourceHint />
          <CombinedPortfolioSourcesPicker
            standardPortfolios={standardPortfolios}
            picked={picked}
            onToggle={toggle}
          />
        </ModalField>
      </AppModalShell>
    </AppModalOverlay>
  );
}
