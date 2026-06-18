"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Loader2 } from "@/lib/icons";
import { toast } from "sonner";

import { ClearableInput } from "@/components/layout/clearable-input";
import { PortfolioPrivacySelect } from "@/components/portfolio/portfolio-privacy-select";
import type { PortfolioPrivacy } from "@/components/portfolio/portfolio-types";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import {
  AppModalFooter,
  AppModalShell,
  appModalCancelButtonClass,
  appModalPrimaryButtonClass,
} from "@/components/ui/app-modal-shell";

const SnapTradeReact = dynamic(
  () => import("snaptrade-react").then((m) => m.SnapTradeReact),
  { ssr: false },
);

export type ConnectBrokerageCompletePayload = {
  name: string;
  privacy: PortfolioPrivacy;
  authorizationId: string;
};

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-2">
      <span className="text-sm font-medium leading-5 text-[#09090B]">{label}</span>
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
  const [step, setStep] = useState<"form" | "portal">("form");
  const [name, setName] = useState("");
  const [privacy, setPrivacy] = useState<PortfolioPrivacy>("private");
  const [portalOpen, setPortalOpen] = useState(false);
  const [portalLink, setPortalLink] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const pendingRef = useRef<{ name: string; privacy: PortfolioPrivacy } | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const reset = useCallback(() => {
    setStep("form");
    setName("");
    setPrivacy("private");
    setPortalOpen(false);
    setPortalLink(null);
    setPortalLoading(false);
    pendingRef.current = null;
  }, []);

  const closeAll = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const startPortal = useCallback(async (pending: { name: string; privacy: PortfolioPrivacy }) => {
    pendingRef.current = pending;
    setPortalLoading(true);
    try {
      const res = await fetch("/api/snaptrade/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as { redirectUri?: string; error?: string };
      if (!res.ok || !data.redirectUri) {
        throw new Error(data.error ?? "Could not open SnapTrade connection portal.");
      }
      setPortalLink(data.redirectUri);
      setStep("portal");
      setPortalOpen(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not open SnapTrade connection portal.";
      toast.error(message);
      closeAll();
    } finally {
      setPortalLoading(false);
    }
  }, [closeAll]);

  const finishWithAuthorization = useCallback(
    async (authorizationId: string | null | undefined) => {
      const pending = pendingRef.current;
      if (!pending) {
        closeAll();
        return;
      }

      let authId = authorizationId?.trim() || "";
      if (!authId) {
        try {
          const res = await fetch("/api/snaptrade/connections", { cache: "no-store" });
          const data = (await res.json()) as {
            connections?: Array<{ id: string; createdDate: string | null }>;
          };
          const rows = Array.isArray(data.connections) ? data.connections : [];
          const sorted = [...rows].sort((a, b) => (b.createdDate ?? "").localeCompare(a.createdDate ?? ""));
          authId = sorted[0]?.id ?? "";
        } catch {
          /* fallback below */
        }
      }

      if (!authId) {
        toast.error("Brokerage connected, but we could not identify the connection. Try again.");
        closeAll();
        return;
      }

      setPortalOpen(false);
      try {
        await onCompleteRef.current({
          name: pending.name,
          privacy: pending.privacy,
          authorizationId: authId,
        });
        closeAll();
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to sync brokerage.";
        toast.error(message);
        closeAll();
      }
    },
    [closeAll],
  );

  const onPortalSuccess = useCallback(
    (authorizationId: string) => {
      void finishWithAuthorization(authorizationId);
    },
    [finishWithAuthorization],
  );

  const onPortalExit = useCallback(() => {
    closeAll();
  }, [closeAll]);

  const onPortalError = useCallback((error: { errorCode?: string; detail?: string }) => {
    const detail =
      typeof error.detail === "string" && error.detail.trim()
        ? error.detail.trim()
        : "Connection failed. Try again or pick a different brokerage.";
    toast.error(detail);
    closeAll();
  }, [closeAll]);

  const canContinue = name.trim().length > 0 && !portalLoading;

  if (!open) return null;

  if (step === "form") {
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
                {portalLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Opening…
                  </>
                ) : (
                  "Continue"
                )}
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
          <ModalField label="Privacy">
            <PortfolioPrivacySelect value={privacy} onChange={setPrivacy} />
          </ModalField>
        </AppModalShell>
      </AppModalOverlay>
    );
  }

  if (!portalOpen || !portalLink) return null;

  return (
    <SnapTradeReact
      loginLink={portalLink}
      isOpen={portalOpen}
      close={onPortalExit}
      onSuccess={onPortalSuccess}
      onError={onPortalError}
      onExit={onPortalExit}
      style={{ overlay: { backgroundColor: "rgba(9, 9, 11, 0.45)", zIndex: 120 } }}
    />
  );
}
