"use client";

/**
 * @deprecated Use {@link PATH_ACCOUNT_PLANS} navigation instead.
 * Kept as a thin redirect so any leftover imports still open Plans.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { PATH_ACCOUNT_PLANS } from "@/lib/auth/routes";

export function BillingUpgradeModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    router.push(PATH_ACCOUNT_PLANS);
    onClose();
  }, [open, onClose, router]);

  return null;
}
