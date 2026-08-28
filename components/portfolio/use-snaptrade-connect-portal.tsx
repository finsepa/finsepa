"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useWindowMessage } from "snaptrade-react";

import type { ConnectBrokerageCompletePayload, PortfolioPrivacy } from "@/components/portfolio/portfolio-types";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import { AppModalShell } from "@/components/ui/app-modal-shell";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/** Match SnapTrade portal chrome to Finsepa (class `dark` on `html`). */
function isAppDarkMode(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

/** Align iframe URL query with the theme requested when the session was created. */
function withSnapTradePortalParams(loginLink: string, darkMode: boolean): string {
  try {
    const url = new URL(loginLink);
    url.searchParams.set("darkMode", darkMode ? "true" : "false");
    return url.toString();
  } catch {
    return loginLink;
  }
}

function SnapTradePortalModal({
  loginLink,
  darkMode,
  open,
  onDismiss,
  onSuccess,
  onError,
}: {
  loginLink: string;
  darkMode: boolean;
  open: boolean;
  onDismiss: () => void;
  onSuccess: (authorizationId: string) => void;
  onError: (error: { errorCode?: string; detail?: string; statusCode?: string }) => void;
}) {
  const titleId = useId();
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeTimedOut, setIframeTimedOut] = useState(false);
  const loadedRef = useRef(false);
  const closedByHostRef = useRef(false);
  const portalOutcomeRef = useRef<"open" | "success">("open");

  const portalSrc = useMemo(
    () => withSnapTradePortalParams(loginLink, darkMode),
    [loginLink, darkMode],
  );

  useWindowMessage({
    handleSuccess: (authorizationId) => {
      portalOutcomeRef.current = "success";
      onSuccess(authorizationId);
    },
    handleError: (data) => {
      onError(data);
    },
    handleExit: () => {
      if (portalOutcomeRef.current === "success") return;
      if (!closedByHostRef.current) onDismiss();
    },
    close: () => {
      if (portalOutcomeRef.current === "success") {
        closedByHostRef.current = true;
        onDismiss();
        return;
      }
      closedByHostRef.current = true;
      onDismiss();
    },
  });

  useEffect(() => {
    if (!open) return;
    loadedRef.current = false;
    setIframeLoaded(false);
    setIframeTimedOut(false);
    closedByHostRef.current = false;
    portalOutcomeRef.current = "open";
    const timer = window.setTimeout(() => {
      if (!loadedRef.current) setIframeTimedOut(true);
    }, 12_000);
    return () => window.clearTimeout(timer);
  }, [open, portalSrc]);

  if (!open) return null;

  return (
    <AppModalOverlay open onClose={onDismiss} zIndex={200} closeOnBackdropClick={false}>
      <AppModalShell
        titleId={titleId}
        title="Connect brokerage"
        onClose={onDismiss}
        maxWidthClass="w-full max-w-[min(450px,calc(100vw-2rem))]"
        maxHeightClass="h-[min(640px,92dvh)] max-h-[min(640px,92dvh)]"
        dialogClassName="min-h-0 flex-1"
        cardClassName="min-h-0 flex-1"
        bodyScroll={false}
        bodyClassName="!flex min-h-0 flex-1 flex-col !overflow-hidden !p-5"
      >
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-surface">
          {!iframeLoaded && !iframeTimedOut ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl bg-surface">
              <Spinner className="size-6 text-fg-muted" />
              <p className="text-sm text-fg-muted">Loading…</p>
            </div>
          ) : null}
          {iframeTimedOut && !iframeLoaded ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl bg-surface px-6 text-center">
              <p className="text-sm text-fg">Broker connection didn&apos;t load.</p>
              <p className="text-xs text-fg-muted">
                Check your connection, then close and try again — or open it in a new tab.
              </p>
              <a
                href={portalSrc}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-accent underline-offset-2 hover:underline"
              >
                Open in a new tab
              </a>
            </div>
          ) : null}
          <iframe
            id="snaptrade-react-connection-portal"
            title="Connect brokerage"
            src={portalSrc}
            className={cn(
              "block min-h-0 w-full flex-1 rounded-xl border-0 bg-surface",
              !iframeLoaded && "opacity-0",
            )}
            allow="clipboard-write"
            onLoad={() => {
              loadedRef.current = true;
              setIframeLoaded(true);
              setIframeTimedOut(false);
            }}
          />
        </div>
      </AppModalShell>
    </AppModalOverlay>
  );
}

export function useSnapTradeConnectPortal({
  onComplete,
  onClose,
}: {
  onComplete: (payload: ConnectBrokerageCompletePayload) => void | Promise<void>;
  onClose: () => void;
}) {
  const [portalOpen, setPortalOpen] = useState(false);
  const [portalLink, setPortalLink] = useState<string | null>(null);
  const [portalDarkMode, setPortalDarkMode] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const pendingRef = useRef<{
    name: string;
    privacy: PortfolioPrivacy;
    /** Reconnect an existing linked portfolio instead of creating a new one. */
    reconnectAuthorizationId?: string;
    reconnectPortfolioId?: string;
  } | null>(null);
  /** SnapTrade sends CLOSE_MODAL right after SUCCESS — don't treat that as cancel. */
  const portalOutcomeRef = useRef<"open" | "success" | "closed">("open");
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const reset = useCallback(() => {
    setPortalOpen(false);
    setPortalLink(null);
    setPortalDarkMode(false);
    setPortalLoading(false);
    pendingRef.current = null;
    portalOutcomeRef.current = "open";
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
      const darkMode = isAppDarkMode();
      try {
        const res = await fetch("/api/snaptrade/portal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            darkMode,
            ...(pending.reconnectAuthorizationId
              ? { reconnectAuthorizationId: pending.reconnectAuthorizationId }
              : {}),
          }),
        });
        const data = (await res.json()) as { redirectUri?: string; error?: string };
        if (!res.ok || !data.redirectUri) {
          throw new Error(data.error ?? "Could not open brokerage connection.");
        }
        setPortalDarkMode(darkMode);
        setPortalLink(data.redirectUri);
        setPortalOpen(true);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Could not open brokerage connection.";
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
      portalOutcomeRef.current = "success";
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
      portalOutcomeRef.current = "success";
      void finishWithAuthorization(authorizationId);
    },
    [finishWithAuthorization],
  );

  const onPortalDismiss = useCallback(() => {
    if (portalOutcomeRef.current === "success") {
      setPortalOpen(false);
      return;
    }
    closeAll();
  }, [closeAll]);

  const onPortalError = useCallback(
    (error: { errorCode?: string; detail?: string }) => {
      const detail =
        typeof error.detail === "string" && error.detail.trim()
          ? error.detail.trim()
          : "Connection failed. Try again or pick a different brokerage.";
      toast.error(detail);
      closeAll();
    },
    [closeAll],
  );

  const portalNode =
    portalOpen && portalLink ? (
      <SnapTradePortalModal
        loginLink={portalLink}
        darkMode={portalDarkMode}
        open={portalOpen}
        onClose={onPortalDismiss}
        onSuccess={onPortalSuccess}
        onError={onPortalError}
        onExit={onPortalDismiss}
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
