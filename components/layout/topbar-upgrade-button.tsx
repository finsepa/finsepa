"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "@/lib/icons";

import { BillingUpgradeModal } from "@/components/account/billing-upgrade-modal";
import { TopbarDelayedTooltip } from "@/components/layout/topbar-delayed-tooltip";
import type { BillingSummary } from "@/lib/account/billing";
import {
  invalidateBillingSummaryMenuCache,
  isBillingSummaryMenuCacheFresh,
  readBillingSummaryMenuCache,
  writeBillingSummaryMenuCache,
} from "@/lib/account/billing-summary-menu-cache";
import { cn } from "@/lib/utils";

/**
 * Upgrade CTA for non-Pro users.
 * Default is hidden until Pro/non-Pro is confirmed — avoids flashing Upgrade for paid users
 * when server gate lags Stripe or local cache is stale.
 */
export function TopbarUpgradeButton({
  userId,
  isPro: isProFromServer = false,
}: {
  userId: string;
  platformTrialDaysLeft?: number | null;
  /** From subscription gate SSR — trusted for first paint when true. */
  isPro?: boolean;
}) {
  const router = useRouter();
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [isPro, setIsPro] = useState(isProFromServer);
  /** False until we know plan (server Pro, cache, or network). Never show Upgrade while false. */
  const [planReady, setPlanReady] = useState(isProFromServer);

  const applyPro = useCallback((next: boolean) => {
    setIsPro(next);
    setPlanReady(true);
  }, []);

  const fetchBillingSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/account/billing/summary", { method: "GET", cache: "no-store" });
      if (!res.ok) {
        setPlanReady(true);
        return;
      }
      const data = (await res.json()) as BillingSummary;
      writeBillingSummaryMenuCache(userId, data);
      applyPro(data.plan === "pro");
    } catch {
      setPlanReady(true);
    }
  }, [userId, applyPro]);

  useEffect(() => {
    if (isProFromServer) {
      applyPro(true);
      return;
    }

    const hit = readBillingSummaryMenuCache(userId);
    // Optimistic hide only when cache already says Pro — never unlock Upgrade from a trial cache
    // (billing summary may have been written before Stripe webhook / status catch-up).
    if (hit?.summary.plan === "pro") {
      applyPro(true);
      if (!isBillingSummaryMenuCacheFresh(hit.fetchedAt)) {
        void fetchBillingSummary();
      }
      return;
    }

    void fetchBillingSummary();
  }, [userId, isProFromServer, applyPro, fetchBillingSummary]);

  // Paid (server or confirmed client) — never show.
  if (isProFromServer || isPro) return null;

  // Unknown — render nothing (not Upgrade). Paid users must never see the CTA flash.
  if (!planReady) return null;

  return (
    <>
      <TopbarDelayedTooltip label="Upgrade" className="hidden shrink-0 md:block">
        <button
          type="button"
          onClick={() => setUpgradeModalOpen(true)}
          className={cn(
            "inline-flex h-9 items-center justify-center gap-1.5 rounded-[10px] bg-[#2563EB] px-3.5 text-[13px] font-semibold text-white",
            "shadow-[0px_1px_2px_0px_rgba(37,99,235,0.2)] transition-colors hover:bg-[#1D4ED8]",
          )}
        >
          <Sparkles className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
          Upgrade
        </button>
      </TopbarDelayedTooltip>

      <BillingUpgradeModal
        open={upgradeModalOpen}
        onClose={() => {
          setUpgradeModalOpen(false);
          invalidateBillingSummaryMenuCache(userId);
          void fetchBillingSummary();
          router.refresh();
        }}
      />
    </>
  );
}
