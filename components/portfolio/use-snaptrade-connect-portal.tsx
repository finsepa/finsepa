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

/**
 * Prefer darkMode already baked into the login link (from `loginSnapTradeUser`).
 * Only add the query flag when missing — don’t rewrite SnapTrade redeem-token URLs.
 */
function withSnapTradePortalParams(loginLink: string, darkMode: boolean): string {
  try {
    const url = new URL(loginLink);
    if (!url.searchParams.has("darkMode")) {
      url.searchParams.set("darkMode", darkMode ? "true" : "false");
    }
    return url.toString();
  } catch {
    return loginLink;
  }
}

/**
 * Match default AppModalShell footprint (Add Manual Transaction): max-w 480.
 *
 * SnapTrade’s official SDK iframe is **600px**. Our body is **640px** =
 * 20px top + 600 iframe + 20px bottom so the SDK is centered. Finsepa chrome
 * never scrolls — only SnapTrade’s internal scroll. Cap by viewport on small screens.
 */
const PORTAL_MODAL_WIDTH = "w-full max-w-[480px]";
const PORTAL_BODY_LOADING_PX = 240;
/** Official snaptrade-react Connection Portal iframe height. */
const SNAPTRADE_IFRAME_DEFAULT_PX = 600;
/** Padding around the SDK iframe (top / sides / bottom) → body = 600 + 40 = 640. */
const PORTAL_IFRAME_INSET_PX = 20;
const PORTAL_BODY_EXPANDED_DEFAULT_PX = SNAPTRADE_IFRAME_DEFAULT_PX + PORTAL_IFRAME_INSET_PX * 2;
/** SnapTrade portal dark canvas (sampled) — Finsepa `--fs-page` is pure #000 and shows as a ring. */
const SNAPTRADE_PORTAL_DARK_BG = "#0a0a0a";
const SNAPTRADE_PORTAL_LIGHT_BG = "#ffffff";
/** SnapTrade API has been 10–46s locally — don’t surface timeout mid-wait. */
const PORTAL_IFRAME_TIMEOUT_MS = 60_000;
const PORTAL_CHROME_RESERVE_PX = 60;

const SNAPTRADE_MESSAGE_ORIGINS = new Set([
  "https://app.snaptrade.com",
  "https://app.staging.snaptrade.com",
  "https://app.local.snaptrade.com",
  "https://connect.snaptrade.com",
  "http://localhost:5173",
]);

function portalMaxBodyPx(): number {
  if (typeof window === "undefined") return PORTAL_BODY_EXPANDED_DEFAULT_PX;
  return Math.max(360, Math.floor(window.innerHeight * 0.9 - PORTAL_CHROME_RESERVE_PX));
}

function readSnapTradePostedHeight(data: unknown): number | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  const raw = row.height ?? row.frameHeight ?? row.contentHeight ?? row.iframeHeight;
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n < 240 || n > 2000) return null;
  return Math.round(n);
}

function SnapTradePortalModal({
  loginLink,
  darkMode,
  open,
  onDismiss,
  onSuccess,
  onError,
}: {
  /** Null while `/api/snaptrade/portal` is in flight. */
  loginLink: string | null;
  darkMode: boolean;
  open: boolean;
  onDismiss: () => void;
  onSuccess: (authorizationId: string) => void;
  onError: (error: { errorCode?: string; detail?: string; statusCode?: string }) => void;
}) {
  const titleId = useId();
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeTimedOut, setIframeTimedOut] = useState(false);
  /** Optional height from SnapTrade postMessage; otherwise SDK default 600. */
  const [snaptradeHeightPx, setSnaptradeHeightPx] = useState<number | null>(null);
  const [viewportMaxPx, setViewportMaxPx] = useState(portalMaxBodyPx);
  const loadedRef = useRef(false);
  const closedByHostRef = useRef(false);
  const portalOutcomeRef = useRef<"open" | "success">("open");

  const portalSrc = useMemo(
    () => (loginLink ? withSnapTradePortalParams(loginLink, darkMode) : null),
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
    setSnaptradeHeightPx(null);
    closedByHostRef.current = false;
    portalOutcomeRef.current = "open";
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const sync = () => setViewportMaxPx(portalMaxBodyPx());
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, [open]);

  // SnapTrade doesn’t document height messages today; listen in case portal posts one.
  useEffect(() => {
    if (!open) return;
    const onMessage = (e: MessageEvent) => {
      if (!SNAPTRADE_MESSAGE_ORIGINS.has(e.origin)) return;
      const h = readSnapTradePostedHeight(e.data);
      if (h != null) setSnaptradeHeightPx(h);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [open]);

  useEffect(() => {
    if (!open || !portalSrc) return;
    loadedRef.current = false;
    setIframeLoaded(false);
    setIframeTimedOut(false);
    setSnaptradeHeightPx(null);
    const timer = window.setTimeout(() => {
      if (!loadedRef.current) setIframeTimedOut(true);
    }, PORTAL_IFRAME_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [open, portalSrc]);

  if (!open) return null;

  const showLoading = !iframeTimedOut && (!portalSrc || !iframeLoaded);
  const showTimeout = Boolean(portalSrc) && iframeTimedOut && !iframeLoaded;
  const expanded = iframeLoaded || showTimeout;
  // Prefer SDK 600 (+ optional posted height); keep 20px pad; never exceed viewport.
  const desiredIframePx = snaptradeHeightPx ?? SNAPTRADE_IFRAME_DEFAULT_PX;
  const iframePx = Math.min(desiredIframePx, Math.max(240, viewportMaxPx - PORTAL_IFRAME_INSET_PX * 2));
  const bodyHeightPx = expanded
    ? Math.min(iframePx + PORTAL_IFRAME_INSET_PX * 2, viewportMaxPx)
    : PORTAL_BODY_LOADING_PX;
  const iframeInset = iframeLoaded ? PORTAL_IFRAME_INSET_PX : 0;
  const portalSurfaceBg = darkMode ? SNAPTRADE_PORTAL_DARK_BG : SNAPTRADE_PORTAL_LIGHT_BG;

  return (
    <AppModalOverlay open onClose={onDismiss} zIndex={200} closeOnBackdropClick={false}>
      <AppModalShell
        titleId={titleId}
        title="Connect brokerage"
        onClose={onDismiss}
        maxWidthClass={PORTAL_MODAL_WIDTH}
        maxHeightClass="max-h-[90dvh] overflow-hidden"
        dialogClassName="overflow-hidden"
        bodyScroll={false}
        cardClassName={cn(
          "!flex-none overflow-hidden",
          darkMode ? "dark:!bg-[#0a0a0a]" : "!bg-white",
        )}
        bodyClassName="!flex-none !overflow-hidden !p-0"
      >
        <div
          className="relative w-full overflow-hidden transition-[height] duration-300 ease-out"
          style={{ height: bodyHeightPx, backgroundColor: portalSurfaceBg }}
        >
          {showLoading ? (
            <div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3"
              style={{ backgroundColor: portalSurfaceBg }}
              role="status"
              aria-live="polite"
            >
              <Spinner className="size-8 text-[#71717A]" />
              <p className="text-sm font-medium text-fg-muted">Loading SnapTrade</p>
            </div>
          ) : null}
          {showTimeout ? (
            <div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-6 text-center"
              style={{ backgroundColor: portalSurfaceBg }}
            >
              <p className="text-sm text-fg">Broker connection didn&apos;t load.</p>
              <p className="text-xs text-fg-muted">
                Check your connection, then close and try again — or open it in a new tab.
              </p>
              {portalSrc ? (
                <a
                  href={portalSrc}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-accent underline-offset-2 hover:underline"
                >
                  Open in a new tab
                </a>
              ) : null}
            </div>
          ) : null}
          {portalSrc ? (
            <iframe
              id="snaptrade-react-connection-portal"
              title="Connect brokerage"
              src={portalSrc}
              className={cn(
                "absolute border-0",
                !iframeLoaded && "pointer-events-none opacity-0",
              )}
              style={{
                top: iframeInset,
                left: iframeInset,
                right: iframeInset,
                width: `calc(100% - ${iframeInset * 2}px)`,
                height: iframeLoaded ? iframePx : 0,
                backgroundColor: portalSurfaceBg,
              }}
              referrerPolicy="no-referrer"
              allow="clipboard-read; clipboard-write"
              onLoad={() => {
                loadedRef.current = true;
                setIframeLoaded(true);
                setIframeTimedOut(false);
              }}
            />
          ) : null}
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
    reconnectAuthorizationId?: string;
    reconnectPortfolioId?: string;
  } | null>(null);
  const portalOutcomeRef = useRef<"open" | "success" | "closed">("open");
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const prefetchRef = useRef<{ redirectUri: string; darkMode: boolean; at: number } | null>(null);
  const prefetchInFlightRef = useRef<Promise<void> | null>(null);

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

  const prefetchPortal = useCallback(async () => {
    if (prefetchRef.current && Date.now() - prefetchRef.current.at < 45_000) return;
    if (prefetchInFlightRef.current) return prefetchInFlightRef.current;
    const darkMode = isAppDarkMode();
    const run = (async () => {
      try {
        const res = await fetch("/api/snaptrade/portal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ darkMode }),
        });
        const data = (await res.json()) as { redirectUri?: string };
        if (res.ok && data.redirectUri) {
          prefetchRef.current = { redirectUri: data.redirectUri, darkMode, at: Date.now() };
        }
      } catch {
        /* warm path only */
      } finally {
        prefetchInFlightRef.current = null;
      }
    })();
    prefetchInFlightRef.current = run;
    return run;
  }, []);

  const startPortal = useCallback(
    async (pending: {
      name: string;
      privacy: PortfolioPrivacy;
      reconnectAuthorizationId?: string;
      reconnectPortfolioId?: string;
    }) => {
      pendingRef.current = pending;
      const darkMode = isAppDarkMode();
      // Open shell immediately so the spinner is visible while SnapTrade login (often 8–20s) runs.
      setPortalDarkMode(darkMode);
      setPortalLink(null);
      setPortalOpen(true);
      setPortalLoading(true);
      portalOutcomeRef.current = "open";
      try {
        if (!pending.reconnectAuthorizationId && prefetchInFlightRef.current) {
          await prefetchInFlightRef.current;
        }
        const cached = prefetchRef.current;
        const useCache =
          !pending.reconnectAuthorizationId &&
          cached != null &&
          cached.darkMode === darkMode &&
          Date.now() - cached.at < 45_000;
        if (useCache && cached) {
          prefetchRef.current = null;
          setPortalLink(cached.redirectUri);
        } else {
          prefetchRef.current = null;
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
          setPortalLink(data.redirectUri);
        }
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

  const portalNode = portalOpen ? (
    <SnapTradePortalModal
      loginLink={portalLink}
      darkMode={portalDarkMode}
      open={portalOpen}
      onDismiss={onPortalDismiss}
      onSuccess={onPortalSuccess}
      onError={onPortalError}
    />
  ) : null;

  return {
    portalLoading,
    portalActive: portalOpen,
    portalNode,
    reset,
    startPortal,
    prefetchPortal,
  };
}
