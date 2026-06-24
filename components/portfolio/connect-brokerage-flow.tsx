"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { SpinnerLabel } from "@/components/ui/spinner";

import { ClearableInput } from "@/components/layout/clearable-input";
import { PortfolioPrivacySelect, PortfolioPrivacyFieldLabel } from "@/components/portfolio/portfolio-privacy-select";
import type { ConnectBrokerageCompletePayload, PortfolioPrivacy } from "@/components/portfolio/portfolio-types";
import { useSnapTradeConnectPortal } from "@/components/portfolio/use-snaptrade-connect-portal";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import {
  AppModalFooter,
  AppModalShell,
  appModalCancelButtonClass,
  appModalPrimaryButtonClass,
} from "@/components/ui/app-modal-shell";

export type { ConnectBrokerageCompletePayload };

function ModalField({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-2">
      {typeof label === "string" ? (
        <span className="text-sm font-medium leading-5 text-[#09090B]">{label}</span>
      ) : (
        label
      )}
      {children}
    </div>
  );
}

/**
 * Step 1: portfolio name + privacy → Step 2: SnapTrade broker picker.
 */
export function ConnectBrokerageFlow({
  open,
  onClose,
  onComplete,
}: {
  open: boolean;
  onClose: () => void;
  onComplete: (payload: ConnectBrokerageCompletePayload) => void | Promise<void>;
}) {
  const titleId = useId();
  const [name, setName] = useState("");
  const [privacy, setPrivacy] = useState<PortfolioPrivacy>("private");

  const { portalLoading, portalActive, portalNode, reset, startPortal } = useSnapTradeConnectPortal({
    onComplete,
    onClose,
  });

  const closeAll = useCallback(() => {
    reset();
    setName("");
    setPrivacy("private");
    onClose();
  }, [onClose, reset]);

  useEffect(() => {
    if (!open) {
      reset();
      setName("");
      setPrivacy("private");
    }
  }, [open, reset]);

  const canContinue = name.trim().length > 0 && !portalLoading;

  if (!open) return null;

  if (portalActive) return portalNode;

  return (
    <AppModalOverlay open onClose={closeAll} zIndex={110}>
      <AppModalShell
        titleId={titleId}
        title="Connect brokerage"
        onClose={closeAll}
        bodyClassName="flex flex-col gap-4 px-5 pb-5 pt-5"
        footer={
          <AppModalFooter>
            <button type="button" onClick={closeAll} className={appModalCancelButtonClass}>
              Cancel
            </button>
            <button
              type="button"
              disabled={!canContinue}
              onClick={() => {
                const t = name.trim();
                if (!t) return;
                void startPortal({ name: t, privacy });
              }}
              className={appModalPrimaryButtonClass(canContinue)}
            >
              {portalLoading ? <SpinnerLabel>Opening…</SpinnerLabel> : "Continue"}
            </button>
          </AppModalFooter>
        }
      >
        <p className="text-sm text-[#71717A]">
          Name your portfolio, then choose a broker to link. Holdings and cash will sync automatically.
        </p>
        <ModalField label="Name">
          <ClearableInput
            type="text"
            value={name}
            onChange={setName}
            placeholder="Enter name"
            clearLabel="Clear name"
          />
        </ModalField>
        <ModalField label={<PortfolioPrivacyFieldLabel />}>
          <PortfolioPrivacySelect value={privacy} onChange={setPrivacy} />
        </ModalField>
      </AppModalShell>
    </AppModalOverlay>
  );
}
