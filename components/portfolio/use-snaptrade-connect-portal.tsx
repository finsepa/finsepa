"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import type { ConnectBrokerageCompletePayload } from "@/components/portfolio/portfolio-types";
import type { PortfolioPrivacy } from "@/components/portfolio/portfolio-types";

const SnapTradeReact = dynamic(
  () => import("snaptrade-react").then((m) => m.SnapTradeReact),
  { ssr: false },
);

export function useSnapTradeConnectPortal({
  onComplete,
  onClose,
}: {
  onComplete: (payload: ConnectBrokerageCompletePayload) => void | Promise<void>;
  onClose: () => void;
}) {
  const [portalOpen, setPortalOpen] = useState(false);
  const [portalLink, setPortalLink] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const pendingRef = useRef<{
    name: string;
    privacy: PortfolioPrivacy;
    /** Reconnect an existing linked portfolio instead of creating a new one. */
    reconnectAuthorizationId?: string;
    reconnectPortfolioId?: string;
  } | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const reset = useCallback(() => {
    setPortalOpen(false);
    setPortalLink(null);
    setPortalLoading(false);
    pendingRef.current = null;
  }, []);

  const closeAll = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const startPortal = useCallback(
    async (pending: {
      name: string;
      privacy: PortfolioPrivacy;
      reconnectAuthorizationId?: string;
      reconnectPortfolioId?: string;
    }) => {
      pendingRef.current = pending;
      setPortalLoading(true);
      try {
        const res = await fetch("/api/snaptrade/portal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            pending.reconnectAuthorizationId
              ? { reconnectAuthorizationId: pending.reconnectAuthorizationId }
              : {},
          ),
        });
        const data = (await res.json()) as { redirectUri?: string; error?: string };
        if (!res.ok || !data.redirectUri) {
          throw new Error(data.error ?? "Could not open SnapTrade connection portal.");
        }
        setPortalLink(data.redirectUri);
        setPortalOpen(true);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Could not open SnapTrade connection portal.";
        toast.error(message);
        closeAll();
      } finally {
        setPortalLoading(false);
      }
    },
    [closeAll],
  );

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
          authorizationId: pending.reconnectAuthorizationId || authId,
          ...(pending.reconnectPortfolioId
            ? { reconnectPortfolioId: pending.reconnectPortfolioId }
            : {}),
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

  const portalNode =
    portalOpen && portalLink ? (
      <SnapTradeReact
        loginLink={portalLink}
        isOpen={portalOpen}
        close={onPortalExit}
        onSuccess={onPortalSuccess}
        onError={onPortalError}
        onExit={onPortalExit}
        style={{ overlay: { backgroundColor: "rgba(15, 15, 15, 0.45)", zIndex: 120 } }}
      />
    ) : null;

  return {
    portalLoading,
    portalActive: portalOpen && portalLink != null,
    portalNode,
    reset,
    startPortal,
  };
}
