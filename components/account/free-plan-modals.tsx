"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import { usePlanAccess } from "@/components/account/plan-access-provider";
import { ProFeatureBadge } from "@/components/account/pro-feature-badge";
import { portfolioIsCombined, portfolioIsDemo } from "@/components/portfolio/portfolio-types";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import {
  AppModalFooter,
  AppModalShell,
  appModalPrimaryButtonClass,
  appModalCancelButtonClass,
} from "@/components/ui/app-modal-shell";
import { SpinnerLabel } from "@/components/ui/spinner";
import { PATH_ACCOUNT_PLANS } from "@/lib/auth/routes";
import { useWatchlist } from "@/lib/watchlist/watchlist-context";
import { cn } from "@/lib/utils";

const pickRowClass = (selected: boolean) =>
  cn(
    "flex w-full items-center gap-2 rounded-[10px] border px-3 py-2.5 text-left text-sm font-medium transition-colors",
    selected
      ? "border-fg bg-surface-subtle text-fg"
      : "border-stroke-subtle bg-surface text-fg hover:bg-surface-muted",
  );

function isFreeLimitsUpgradeEscapePath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === PATH_ACCOUNT_PLANS || pathname.startsWith(`${PATH_ACCOUNT_PLANS}/`);
}

/**
 * First Free session after trial — must acknowledge limits and pick Free slots when over quota.
 * Cannot dismiss via X or backdrop. Upgrade may open Plans without finishing; leaving Plans
 * brings the modal back until Continue on Free saves the picks.
 */
export function FreePlanLimitsIntroModal() {
  const {
    shouldShowFreeLimitsIntro,
    ackFreeLimits,
    isFree,
    selectFreePortfolio,
    selectFreeWatchlist,
  } = usePlanAccess();
  const { portfolios, portfolioListReady } = usePortfolioWorkspace();
  const { watchlists } = useWatchlist();
  const titleId = useId();
  const router = useRouter();
  const pathname = usePathname();
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null);
  const [selectedWatchlistId, setSelectedWatchlistId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const listedPortfolios = useMemo(
    () => portfolios.filter((p) => !portfolioIsDemo(p)),
    [portfolios],
  );
  const manualPortfolios = useMemo(
    () =>
      listedPortfolios.filter(
        (p) => p.kind !== "combined" && !portfolioIsCombined(p) && p.snaptrade == null,
      ),
    [listedPortfolios],
  );
  const combinedPortfolios = useMemo(
    () => listedPortfolios.filter((p) => p.kind === "combined" || portfolioIsCombined(p)),
    [listedPortfolios],
  );
  const brokeragePortfolios = useMemo(
    () =>
      listedPortfolios.filter(
        (p) =>
          p.snaptrade != null &&
          p.kind !== "combined" &&
          !portfolioIsCombined(p),
      ),
    [listedPortfolios],
  );

  const showPortfolioSection =
    !portfolioListReady ||
    manualPortfolios.length > 0 ||
    combinedPortfolios.length > 0 ||
    brokeragePortfolios.length > 0;
  const mustPickPortfolio = portfolioListReady && manualPortfolios.length > 1;
  const showWatchlistPicker = watchlists.length > 1;
  const showSelectionBlock = showPortfolioSection || showWatchlistPicker;

  useEffect(() => {
    if (!shouldShowFreeLimitsIntro || !portfolioListReady) return;
    setSelectedPortfolioId((prev) => {
      if (prev && manualPortfolios.some((p) => p.id === prev)) return prev;
      return manualPortfolios.length === 1 ? manualPortfolios[0]!.id : null;
    });
    setSelectedWatchlistId((prev) => {
      if (prev && watchlists.some((w) => w.id === prev)) return prev;
      return watchlists.length === 1 ? watchlists[0]!.id : null;
    });
  }, [shouldShowFreeLimitsIntro, portfolioListReady, manualPortfolios, watchlists]);

  const canFinish =
    portfolioListReady &&
    (!mustPickPortfolio || Boolean(selectedPortfolioId)) &&
    (!showWatchlistPicker || Boolean(selectedWatchlistId)) &&
    !busy;

  async function continueOnFree() {
    if (!canFinish) return;
    setBusy(true);
    try {
      if (mustPickPortfolio && selectedPortfolioId) {
        const ok = await selectFreePortfolio(selectedPortfolioId);
        if (!ok) {
          toast.error("Could not save portfolio. Try again.");
          return;
        }
      } else if (manualPortfolios.length === 1) {
        const ok = await selectFreePortfolio(manualPortfolios[0]!.id);
        if (!ok) {
          toast.error("Could not save portfolio. Try again.");
          return;
        }
      }

      if (showWatchlistPicker && selectedWatchlistId) {
        const ok = await selectFreeWatchlist(selectedWatchlistId);
        if (!ok) {
          toast.error("Could not save watchlist. Try again.");
          return;
        }
      } else if (watchlists.length === 1) {
        const ok = await selectFreeWatchlist(watchlists[0]!.id);
        if (!ok) {
          toast.error("Could not save watchlist. Try again.");
          return;
        }
      }

      const acked = await ackFreeLimits();
      if (acked) {
        toast.success("You’re on Free", {
          description: "Your selected portfolio and watchlist are locked in until you upgrade.",
        });
      }
    } finally {
      setBusy(false);
    }
  }

  function openUpgradePlans() {
    // Do not ack — leaving Plans without finishing Free setup must reopen this modal.
    router.push(PATH_ACCOUNT_PLANS);
  }

  if (!isFree || !shouldShowFreeLimitsIntro || isFreeLimitsUpgradeEscapePath(pathname)) {
    return null;
  }

  return (
    <AppModalOverlay open closeOnBackdropClick={false} zIndex={240}>
      <AppModalShell
        titleId={titleId}
        title="You're on the Free plan"
        showClose={false}
        bodyClassName="space-y-4 px-5 py-5"
        footer={
          <AppModalFooter>
            <button
              type="button"
              disabled={busy}
              onClick={openUpgradePlans}
              className={cn(appModalCancelButtonClass, "disabled:cursor-not-allowed disabled:opacity-50")}
            >
              Upgrade to Pro
            </button>
            <button
              type="button"
              disabled={!canFinish}
              onClick={() => void continueOnFree()}
              className={appModalPrimaryButtonClass(canFinish)}
            >
              {busy ? <SpinnerLabel>Saving…</SpinnerLabel> : "Continue on Free"}
            </button>
          </AppModalFooter>
        }
      >
        <div className="space-y-3">
          <p className="text-[14px] leading-5 text-fg-muted">
            You&apos;re on Free now. Full access is limited until you upgrade.
          </p>
          <ul className="list-disc space-y-2 pl-5 text-[14px] leading-5 text-fg-muted">
            <li>
              <span className="text-fg">1 manual portfolio</span> and{" "}
              <span className="text-fg">1 watchlist</span> stay active
            </li>
            <li>If you made more than the Free limits, pick which ones to keep below</li>
            <li>Brokerage portfolios stay saved but freeze (no sync) on Free</li>
            <li className="text-fg">Upgrade to Pro to unlock everything</li>
          </ul>
        </div>

        {showSelectionBlock ? (
          <div className="space-y-4 border-t border-stroke pt-4">
            {showPortfolioSection ? (
              <div className="space-y-2">
                <div className="text-[13px] font-semibold leading-5 text-fg">Portfolios</div>
                {!portfolioListReady ? (
                  <p className="text-[13px] leading-5 text-fg-muted">Loading your portfolios…</p>
                ) : (
                  <>
                    {manualPortfolios.length > 0 ? (
                      <ul
                        className="flex flex-col gap-1.5"
                        role="radiogroup"
                        aria-label="Free portfolio"
                      >
                        {manualPortfolios.map((p) => {
                          const selected = selectedPortfolioId === p.id;
                          return (
                            <li key={p.id}>
                              <button
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                disabled={busy || !mustPickPortfolio}
                                onClick={() => {
                                  if (!mustPickPortfolio) return;
                                  setSelectedPortfolioId(p.id);
                                }}
                                className={cn(
                                  pickRowClass(selected),
                                  !mustPickPortfolio && "cursor-default",
                                )}
                              >
                                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                                <span className="shrink-0 text-[12px] font-normal text-fg-muted">
                                  Manual
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                    {combinedPortfolios.length > 0 ? (
                      <ul className="flex flex-col gap-1.5" aria-label="Combined portfolios">
                        {combinedPortfolios.map((p) => (
                          <li
                            key={p.id}
                            className="flex w-full items-center gap-2 rounded-[10px] border border-stroke-subtle bg-surface-muted/60 px-3 py-2.5 text-sm text-fg-muted"
                            title="Combined portfolios require Pro"
                          >
                            <span className="min-w-0 flex-1 truncate">{p.name}</span>
                            <ProFeatureBadge
                              label="Combined portfolios are available on Pro only"
                              zIndex={350}
                            />
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {brokeragePortfolios.length > 0 ? (
                      <ul className="flex flex-col gap-1.5">
                        {brokeragePortfolios.map((p) => (
                          <li
                            key={p.id}
                            className="flex w-full items-center gap-2 rounded-[10px] border border-stroke-subtle bg-surface-muted/60 px-3 py-2.5 text-sm text-fg-muted"
                          >
                            <span className="min-w-0 flex-1 truncate">{p.name}</span>
                            <span className="shrink-0 text-[12px]">Frozen</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <p className="text-[12px] leading-4 text-fg-muted">
                      {mustPickPortfolio
                        ? "Choose one manual portfolio to keep active on Free. Combined stays locked until Pro."
                        : manualPortfolios.length === 1
                          ? "This manual portfolio stays active on Free. Combined stays locked until Pro."
                          : "You have no manual portfolio yet — combined and brokerage stay locked until Pro."}
                    </p>
                  </>
                )}
              </div>
            ) : null}

            {showWatchlistPicker ? (
              <div className="space-y-2">
                <div className="text-[13px] font-semibold leading-5 text-fg">Watchlists</div>
                <ul className="flex flex-col gap-1.5" role="radiogroup" aria-label="Free watchlist">
                  {watchlists.map((w) => {
                    const selected = selectedWatchlistId === w.id;
                    return (
                      <li key={w.id}>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          disabled={busy}
                          onClick={() => setSelectedWatchlistId(w.id)}
                          className={pickRowClass(selected)}
                        >
                          <span className="min-w-0 flex-1 truncate">{w.name}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-[12px] leading-4 text-fg-muted">
                  Choose one watchlist to keep active on Free.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </AppModalShell>
    </AppModalOverlay>
  );
}

export function FreePortfolioPickModal({
  open,
  portfolios,
  onClose,
}: {
  open: boolean;
  portfolios: {
    id: string;
    name: string;
    isDemo?: boolean;
    kind?: string;
    /** Brokerage-linked books cannot be the Free active portfolio. */
    snaptrade?: unknown;
  }[];
  onClose: () => void;
}) {
  const { selectFreePortfolio, needsFreePortfolioPick } = usePlanAccess();
  const titleId = useId();
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const options = portfolios.filter(
    (p) =>
      p.kind !== "combined" &&
      !p.isDemo &&
      p.kind !== "demo" &&
      p.snaptrade == null,
  );
  const frozenBrokerage = portfolios.filter(
    (p) => p.kind !== "combined" && !p.isDemo && p.kind !== "demo" && p.snaptrade != null,
  );

  if (!open || !needsFreePortfolioPick) return null;

  return (
    <AppModalOverlay open onClose={onClose} zIndex={250}>
      <AppModalShell
        titleId={titleId}
        title="Choose your Free portfolio"
        onClose={onClose}
        bodyClassName="flex flex-col gap-3 px-5 pb-5 pt-1"
        footer={
          <AppModalFooter>
            <button type="button" onClick={onClose} className={appModalCancelButtonClass}>
              Cancel
            </button>
            {options.length === 0 ? (
              <button
                type="button"
                onClick={() => router.push(PATH_ACCOUNT_PLANS)}
                className={appModalPrimaryButtonClass(true)}
              >
                Upgrade to Pro
              </button>
            ) : (
              <button
                type="button"
                disabled={!selected || busy}
                className={appModalPrimaryButtonClass(Boolean(selected) && !busy)}
                onClick={() => {
                  if (!selected) return;
                  setBusy(true);
                  void selectFreePortfolio(selected)
                    .then((ok) => {
                      if (ok) {
                        toast.success("Free portfolio saved. You can’t switch this on Free.");
                        onClose();
                      } else {
                        toast.error("Could not save selection. Try again.");
                      }
                    })
                    .finally(() => setBusy(false));
                }}
              >
                Keep this portfolio
              </button>
            )}
          </AppModalFooter>
        }
      >
        <p className="text-[14px] leading-5 text-fg-muted">
          Free allows full access to <span className="text-fg">one manual</span> portfolio. Offline
          brokerage snapshots stay open read-only; live sync needs Pro.
        </p>
        {frozenBrokerage.length > 0 ? (
          <p className="text-[13px] leading-5 text-fg-muted">
            {frozenBrokerage.length} brokerage portfolio
            {frozenBrokerage.length === 1 ? "" : "s"} stay frozen (no sync) until you upgrade.
          </p>
        ) : null}
        {options.length === 0 ? (
          <p className="text-[14px] leading-5 text-fg">
            You only have brokerage-linked portfolios. You can open them as offline copies, or
            create a new manual portfolio for your Free slot. Upgrade to Pro to live-sync brokerage again.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {options.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setSelected(p.id)}
                  className={
                    selected === p.id
                      ? "flex w-full items-center rounded-[10px] border border-fg bg-surface-subtle px-3 py-2.5 text-left text-sm font-medium text-fg"
                      : "flex w-full items-center rounded-[10px] border border-stroke-subtle bg-surface px-3 py-2.5 text-left text-sm font-medium text-fg hover:bg-surface-muted"
                  }
                >
                  {p.name}
                  <span className="ml-auto pl-2 text-[12px] font-normal text-fg-muted">Manual</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </AppModalShell>
    </AppModalOverlay>
  );
}

export function FreeWatchlistPickModal({
  open,
  watchlists,
  onClose,
}: {
  open: boolean;
  watchlists: { id: string; name: string }[];
  onClose: () => void;
}) {
  const { selectFreeWatchlist, needsFreeWatchlistPick } = usePlanAccess();
  const titleId = useId();
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open || !needsFreeWatchlistPick) return null;

  return (
    <AppModalOverlay open onClose={onClose} zIndex={250}>
      <AppModalShell
        titleId={titleId}
        title="Choose your Free watchlist"
        onClose={onClose}
        bodyClassName="flex flex-col gap-3 px-5 pb-5 pt-1"
        footer={
          <AppModalFooter>
            <button type="button" onClick={onClose} className={appModalCancelButtonClass}>
              Cancel
            </button>
            <button
              type="button"
              disabled={!selected || busy}
              className={appModalPrimaryButtonClass(Boolean(selected) && !busy)}
              onClick={() => {
                if (!selected) return;
                setBusy(true);
                void selectFreeWatchlist(selected)
                  .then((ok) => {
                    if (ok) {
                      toast.success("Free watchlist saved. You can’t switch this on Free.");
                      onClose();
                    } else {
                      toast.error("Could not save selection. Try again.");
                    }
                  })
                  .finally(() => setBusy(false));
              }}
            >
              Keep this watchlist
            </button>
          </AppModalFooter>
        }
      >
        <p className="text-[14px] leading-5 text-fg-muted">
          Free allows full access to one watchlist. This choice is permanent until you upgrade to
          Pro.
        </p>
        <ul className="flex flex-col gap-2">
          {watchlists.map((w) => (
            <li key={w.id}>
              <button
                type="button"
                onClick={() => setSelected(w.id)}
                className={
                  selected === w.id
                    ? "flex w-full items-center rounded-[10px] border border-fg bg-surface-subtle px-3 py-2.5 text-left text-sm font-medium text-fg"
                    : "flex w-full items-center rounded-[10px] border border-stroke-subtle bg-surface px-3 py-2.5 text-left text-sm font-medium text-fg hover:bg-surface-muted"
                }
              >
                {w.name}
              </button>
            </li>
          ))}
        </ul>
      </AppModalShell>
    </AppModalOverlay>
  );
}
