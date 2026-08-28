"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useWindowMessage } from "snaptrade-react";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

function withSnapTradePortalParams(loginLink: string, darkMode: boolean): string {
  try {
    const url = new URL(loginLink);
    url.searchParams.set("darkMode", darkMode ? "true" : "false");
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

  const portalSrc = useMemo(
    () => (loginLink ? withSnapTradePortalParams(loginLink, darkMode) : ""),
    [loginLink, darkMode],
  );

  useWindowMessage({
    handleSuccess: (authorizationId) => {
      forwardToNative({ status: "SUCCESS", authorizationId });
    },
    handleError: (data) => {
      forwardToNative({ status: "ERROR", ...data });
    },
    handleExit: () => {
      forwardToNative("ABANDONED");
    },
    close: () => {
      forwardToNative("CLOSE_MODAL");
    },
  });

  if (!portalSrc) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-fg">Missing SnapTrade portal link.</p>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-[60vh] flex-1 flex-col overflow-hidden bg-surface">
      <iframe
        id="snaptrade-react-connection-portal"
        title="Connect brokerage via SnapTrade"
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
          <p className="text-sm text-fg-muted">Loading SnapTrade…</p>
        </div>
      }
    >
      <SnapTradeEmbedInner />
    </Suspense>
  );
}
