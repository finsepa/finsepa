"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useWindowMessage } from "snaptrade-react";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

function withSnapTradePortalParams(loginLink: string, darkMode: boolean): string {
  try {
    const url = new URL(loginLink);
    if (!url.searchParams.has("reactSDK")) url.searchParams.set("reactSDK", "finsepa-ios-embed");
    if (!url.searchParams.has("darkMode")) {
      url.searchParams.set("darkMode", darkMode ? "true" : "false");
    }
    return url.toString();
  } catch {
    return loginLink;
  }
}

function forwardToNative(payload: unknown) {
  const handler = (
    window as Window & {
      webkit?: { messageHandlers?: { snaptradePortal?: { postMessage: (body: unknown) => void } } };
    }
  ).webkit?.messageHandlers?.snaptradePortal;
  try {
    handler?.postMessage(payload);
  } catch {
    /* native bridge unavailable (web preview) */
  }
}

function SnapTradeEmbedInner() {
  const searchParams = useSearchParams();
  const loginLink = searchParams.get("link")?.trim() ?? "";
  const darkMode = searchParams.get("darkMode") === "true";
  const portalOutcomeRef = useRef<{ succeeded: boolean; authorizationId: string }>({
    succeeded: false,
    authorizationId: "",
  });

  const portalSrc = useMemo(
    () => (loginLink ? withSnapTradePortalParams(loginLink, darkMode) : ""),
    [loginLink, darkMode],
  );

  useWindowMessage({
    handleSuccess: (authorizationId) => {
      const authId = String(authorizationId ?? "").trim();
      portalOutcomeRef.current = { succeeded: true, authorizationId: authId };
      forwardToNative({ status: "SUCCESS", authorizationId: authId || undefined });
    },
    handleError: (data) => {
      portalOutcomeRef.current = { succeeded: false, authorizationId: "" };
      forwardToNative({ status: "ERROR", ...data });
    },
    handleExit: () => {
      if (portalOutcomeRef.current.succeeded) return;
      forwardToNative({ status: "ABANDONED" });
    },
    close: () => {
      if (portalOutcomeRef.current.succeeded) {
        forwardToNative({
          status: "SUCCESS",
          authorizationId: portalOutcomeRef.current.authorizationId || undefined,
          close: true,
        });
        return;
      }
      forwardToNative({ status: "CLOSE_MODAL" });
    },
  });

  useEffect(() => {
    portalOutcomeRef.current = { succeeded: false, authorizationId: "" };
  }, [portalSrc]);

  if (!portalSrc) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-fg">Missing brokerage connection link.</p>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-[60vh] flex-1 flex-col overflow-hidden bg-surface">
      <iframe
        id="snaptrade-react-connection-portal"
        title="Connect brokerage"
        src={portalSrc}
        className={cn("block min-h-[60vh] w-full flex-1 border-0 bg-surface")}
        allow="clipboard-read; clipboard-write"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}

export function SnapTradeEmbedClient() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
          <Spinner className="size-6 text-fg-muted" />
          <p className="text-sm text-fg-muted">Loading…</p>
        </div>
      }
    >
      <SnapTradeEmbedInner />
    </Suspense>
  );
}
