"use client";

import { toast } from "sonner";

import { PATH_ACCOUNT_PLANS } from "@/lib/auth/routes";

/**
 * Free/Pro gate toast: stays on the current page with an Upgrade action
 * that navigates to Plans (no auto-redirect).
 */
export function toastProUpgrade(args: {
  title: string;
  description: string;
  /** Prefer Next router.push; defaults to hard navigation to Plans. */
  onUpgrade?: () => void;
}): void {
  toast.error(args.title, {
    description: args.description,
    action: {
      label: "Upgrade",
      onClick: () => {
        if (args.onUpgrade) {
          args.onUpgrade();
          return;
        }
        if (typeof window !== "undefined") {
          window.location.assign(PATH_ACCOUNT_PLANS);
        }
      },
    },
  });
}
