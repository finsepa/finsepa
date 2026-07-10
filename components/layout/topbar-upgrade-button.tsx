"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "@/lib/icons";

import { BillingUpgradeModal } from "@/components/account/billing-upgrade-modal";
import { TopbarDelayedTooltip } from "@/components/layout/topbar-delayed-tooltip";
import {
  EMPTY_BILLING_SUMMARY,
  subscriptionTitleFromBillingSummary,
  type BillingSummary,
} from "@/lib/account/billing";
import {
  invalidateBillingSummaryMenuCache,
  isBillingSummaryMenuCacheFresh,
  readBillingSummaryMenuCache,
  writeBillingSummaryMenuCache,
} from "@/lib/account/billing-summary-menu-cache";

export function TopbarUpgradeButton({
  userId,
  platformTrialDaysLeft = null,
}: {
  userId: string;
  platformTrialDaysLeft?: number | null;
}) {
  const router = useRouter();
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [planLabel, setPlanLabel] = useState<string>(() =>
    subscriptionTitleFromBillingSummary(EMPTY_BILLING_SUMMARY),
  );
  const [isPro, setIsPro] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);

  const applyBillingSummary = useCallback((summary: BillingSummary) => {
    setPlanLabel(subscriptionTitleFromBillingSummary(summary));
    setIsPro(summary.plan === "pro");
  }, []);

  const fetchBillingSummary = useCallback(
    async (opts: { showSkeleton: boolean }) => {
      if (opts.showSkeleton) setPlanLoading(true);
      try {
        const res = await fetch("/api/account/billing/summary", { method: "GET", cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as BillingSummary;
        writeBillingSummaryMenuCache(userId, data);
        applyBillingSummary(data);
      } catch {
        // ignore
      } finally {
        if (opts.showSkeleton) setPlanLoading(false);
      }
    },
    [userId, applyBillingSummary],
  );

  useEffect(() => {
    const hit = readBillingSummaryMenuCache(userId);
    if (hit) applyBillingSummary(hit.summary);
  }, [userId, applyBillingSummary]);

  useEffect(() => {
    const cached = readBillingSummaryMenuCache(userId);
    if (cached && isBillingSummaryMenuCacheFresh(cached.fetchedAt)) return;
    void fetchBillingSummary({ showSkeleton: !cached });
  }, [userId, fetchBillingSummary]);

  const showTrialCountdown =
    typeof platformTrialDaysLeft === "number" && platformTrialDaysLeft > 0;

  const showUpgrade = useMemo(() => {
    if (showTrialCountdown) return true;
    if (isPro || planLabel === "Pro") return false;
    if (planLoading && !readBillingSummaryMenuCache(userId)) return false;
    return true;
  }, [showTrialCountdown, isPro, planLabel, planLoading, userId]);

  if (!showUpgrade) return null;

  return (
    <>
      <TopbarDelayedTooltip label="Upgrade" className="hidden shrink-0 md:block">
        <button
          type="button"
          onClick={() => setUpgradeModalOpen(true)}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[10px] bg-[#2563EB] px-3.5 text-[13px] font-semibold text-white shadow-[0px_1px_2px_0px_rgba(37,99,235,0.2)] transition-colors hover:bg-[#1D4ED8]"
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
          void fetchBillingSummary({ showSkeleton: false });
          router.refresh();
        }}
      />
    </>
  );
}
