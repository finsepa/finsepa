"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Loader2, Landmark, RefreshCw, Trash2 } from "@/lib/icons";
import { toast } from "sonner";

import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import {
  AppModalFooter,
  AppModalShell,
  appModalCancelButtonClass,
  appModalDangerButtonClass,
  appModalPrimaryButtonClass,
} from "@/components/ui/app-modal-shell";
import type { SnapTradeConnectionSummary } from "@/lib/snaptrade/types";
import { cn } from "@/lib/utils";

const SnapTradeReact = dynamic(
  () => import("snaptrade-react").then((m) => m.SnapTradeReact),
  { ssr: false },
);

function formatConnectionDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return format(parseISO(iso), "MMM d, yyyy");
  } catch {
    return null;
  }
}

export function ConnectBrokerageModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [connections, setConnections] = useState<SnapTradeConnectionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [portalOpen, setPortalOpen] = useState(false);
  const [portalLink, setPortalLink] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [reconnectId, setReconnectId] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  const loadConnections = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/snaptrade/connections", { cache: "no-store" });
      const data = (await res.json()) as {
        configured?: boolean;
        connections?: SnapTradeConnectionSummary[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to load brokerage connections.");
      }
      setConfigured(data.configured === true);
      setConnections(Array.isArray(data.connections) ? data.connections : []);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load brokerage connections.";
      toast.error(message);
      setConfigured(false);
      setConnections([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadConnections();
  }, [open, loadConnections]);

  const openPortal = useCallback(
    async (options?: { reconnectAuthorizationId?: string | null }) => {
      setPortalLoading(true);
      setReconnectId(options?.reconnectAuthorizationId ?? null);
      try {
        const res = await fetch("/api/snaptrade/portal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reconnectAuthorizationId: options?.reconnectAuthorizationId ?? undefined,
          }),
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
      } finally {
        setPortalLoading(false);
      }
    },
    [],
  );

  const closePortal = useCallback(() => {
    setPortalOpen(false);
    setPortalLink(null);
    setReconnectId(null);
  }, []);

  const onPortalSuccess = useCallback(() => {
    closePortal();
    toast.success("Brokerage connected.");
    void loadConnections();
  }, [closePortal, loadConnections]);

  const onPortalError = useCallback((error: { errorCode?: string; detail?: string }) => {
    const detail =
      typeof error.detail === "string" && error.detail.trim() ?
        error.detail.trim()
      : "Connection failed. Try again or pick a different brokerage.";
    toast.error(detail);
  }, []);

  const disconnect = useCallback(
    async (authorizationId: string, label: string) => {
      const confirmed = window.confirm(`Disconnect ${label}? This removes the link from SnapTrade.`);
      if (!confirmed) return;

      setDisconnectingId(authorizationId);
      try {
        const res = await fetch(`/api/snaptrade/connections/${encodeURIComponent(authorizationId)}`, {
          method: "DELETE",
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          throw new Error(data.error ?? "Failed to disconnect brokerage.");
        }
        toast.success("Brokerage disconnected.");
        await loadConnections();
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to disconnect brokerage.";
        toast.error(message);
      } finally {
        setDisconnectingId(null);
      }
    },
    [loadConnections],
  );

  const handleClose = useCallback(() => {
    if (portalOpen) return;
    onClose();
  }, [onClose, portalOpen]);

  return (
    <>
      <AppModalOverlay open={open && !portalOpen} onClose={handleClose}>
        <AppModalShell
          title="Connect brokerage"
          onClose={handleClose}
          maxWidthClass="w-full max-w-[560px]"
          bodyClassName="flex flex-col gap-4 px-5 pb-5 pt-2"
          footer={
            <AppModalFooter>
              <button type="button" className={appModalCancelButtonClass} onClick={handleClose}>
                Close
              </button>
              <button
                type="button"
                disabled={configured !== true || portalLoading}
                className={appModalPrimaryButtonClass(configured === true && !portalLoading)}
                onClick={() => void openPortal()}
              >
                {portalLoading ?
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Opening portal…
                  </>
                : "Connect brokerage"}
              </button>
            </AppModalFooter>
          }
        >
          <p className="text-sm text-[#71717A]">
            Link a read-only brokerage account through SnapTrade. Holdings sync is coming next.
          </p>
          {configured === false ?
            <p className="text-sm text-[#71717A]">
              SnapTrade is not configured yet. Add <code className="text-xs">SNAPTRADE_CLIENT_ID</code> and{" "}
              <code className="text-xs">SNAPTRADE_CONSUMER_KEY</code> to your environment, run the database
              migration, and redeploy.
            </p>
          : null}

          {configured !== false ?
            <div className="space-y-3">
              {loading ?
                <div className="flex items-center gap-2 py-6 text-sm text-[#71717A]">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Loading connections…
                </div>
              : connections.length === 0 ?
                <div className="rounded-xl border border-dashed border-[#E4E4E7] bg-[#FAFAFA] px-4 py-8 text-center">
                  <Landmark className="mx-auto mb-3 h-8 w-8 text-[#A1A1AA]" aria-hidden />
                  <p className="text-sm font-medium text-[#09090B]">No brokerage connected yet</p>
                  <p className="mt-1 text-sm text-[#71717A]">
                    Connect your broker to import holdings automatically.
                  </p>
                </div>
              : connections.map((connection) => {
                  const label =
                    connection.brokerageName ??
                    connection.name ??
                    connection.brokerageSlug ??
                    "Brokerage";
                  const connectedOn = formatConnectionDate(connection.createdDate);
                  const isDisconnecting = disconnectingId === connection.id;

                  return (
                    <div
                      key={connection.id}
                      className="flex flex-col gap-3 rounded-xl border border-[#E4E4E7] bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[#09090B]">{label}</p>
                        <p className="mt-0.5 text-xs text-[#71717A]">
                          {connection.disabled ?
                            "Needs reconnect"
                          : "Connected"}
                          {connectedOn ? ` · ${connectedOn}` : ""}
                          {connection.connectionType ? ` · ${connection.connectionType}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        {connection.disabled ?
                          <button
                            type="button"
                            disabled={portalLoading}
                            onClick={() => void openPortal({ reconnectAuthorizationId: connection.id })}
                            className={cn(
                              "inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-[#E4E4E7] bg-white px-3 text-xs font-medium text-[#09090B]",
                              "hover:bg-[#F4F4F5] disabled:opacity-50",
                            )}
                          >
                            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                            Reconnect
                          </button>
                        : null}
                        <button
                          type="button"
                          disabled={isDisconnecting}
                          onClick={() => void disconnect(connection.id, label)}
                          className={cn(appModalDangerButtonClass(!isDisconnecting), "h-8 gap-1.5 px-3 text-xs")}
                        >
                          {isDisconnecting ?
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                          : <Trash2 className="h-3.5 w-3.5" aria-hidden />}
                          Disconnect
                        </button>
                      </div>
                    </div>
                  );
                })
              }
            </div>
          : null}
        </AppModalShell>
      </AppModalOverlay>

      {portalOpen && portalLink ?
        <SnapTradeReact
          loginLink={portalLink}
          isOpen={portalOpen}
          close={closePortal}
          onSuccess={onPortalSuccess}
          onError={onPortalError}
          onExit={closePortal}
          style={{ overlay: { backgroundColor: "rgba(9, 9, 11, 0.45)", zIndex: 80 } }}
        />
      : null}
    </>
  );
}

export function ConnectBrokerageButton({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Connect brokerage"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] border border-[#E4E4E7] bg-white px-3 text-sm font-medium text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-all duration-100",
          "hover:bg-[#F4F4F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15 focus-visible:ring-offset-2",
          className,
        )}
      >
        <Landmark className="h-4 w-4" aria-hidden />
        {!compact ? <span className="hidden sm:inline">Connect Brokerage</span> : null}
      </button>
      <ConnectBrokerageModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
