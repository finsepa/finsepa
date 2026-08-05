"use client";

import { useEffect, useId, useState, type FormEvent } from "react";

import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import {
  AppModalFooter,
  AppModalShell,
  appModalCancelButtonClass,
  appModalDangerButtonClass,
} from "@/components/ui/app-modal-shell";
import { SpinnerLabel } from "@/components/ui/spinner";
import { textInputFieldClassName } from "@/components/design-system";
import { DELETE_ACCOUNT_CONFIRM_PHRASE } from "@/lib/account/delete-account-confirm";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  onDeleted: () => void | Promise<void>;
};

export function DeleteAccountModal({ open, onClose, onDeleted }: Props) {
  const titleId = useId();
  const confirmId = useId();
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canDelete =
    !loading && confirmText.trim() === DELETE_ACCOUNT_CONFIRM_PHRASE;

  useEffect(() => {
    if (!open) return;
    setConfirmText("");
    setLoading(false);
    setErrorMessage(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, loading]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canDelete) return;

    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: confirmText.trim() }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; message?: string }
        | null;

      if (!res.ok) {
        setErrorMessage(
          data?.message || "Could not delete account. Please try again.",
        );
        return;
      }

      await onDeleted();
    } catch {
      setErrorMessage("Could not delete account. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <AppModalOverlay
      open={open}
      onClose={loading ? () => undefined : onClose}
      zIndex={280}
    >
      <AppModalShell
        titleId={titleId}
        title="Delete account"
        onClose={loading ? undefined : onClose}
        closeDisabled={loading}
        bodyClassName="space-y-4 px-5 py-5"
        footer={
          <AppModalFooter className="justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className={appModalCancelButtonClass}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="delete-account-form"
              disabled={!canDelete}
              className={appModalDangerButtonClass(canDelete)}
            >
              {loading ? (
                <SpinnerLabel>Deleting…</SpinnerLabel>
              ) : (
                "Delete account"
              )}
            </button>
          </AppModalFooter>
        }
      >
        <form
          id="delete-account-form"
          className="space-y-4"
          onSubmit={(e) => void handleSubmit(e)}
          noValidate
        >
          <p className="text-sm leading-5 text-fg">
            This permanently deletes your Finsepa account. It cannot be undone.
          </p>
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-5 text-fg-muted">
            <li>All portfolios, holdings, and transactions</li>
            <li>Watchlists, notifications, and agent chats</li>
            <li>Profile details and saved preferences</li>
            <li>Connected brokerages (SnapTrade)</li>
            <li>Stripe subscription and billing customer</li>
          </ul>
          <p className="text-sm leading-5 text-fg-muted">
            Export or note anything you need before continuing. Invoice history
            may remain in Stripe for accounting; it is no longer linked to a live
            account.
          </p>

          {errorMessage ? (
            <div
              role="alert"
              className="rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-sm text-down"
            >
              {errorMessage}
            </div>
          ) : null}

          <div>
            <label
              htmlFor={confirmId}
              className="mb-1.5 block text-sm font-medium text-fg"
            >
              Type{" "}
              <span className="font-semibold tracking-wide">
                {DELETE_ACCOUNT_CONFIRM_PHRASE}
              </span>{" "}
              to confirm
            </label>
            <input
              id={confirmId}
              type="text"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={confirmText}
              disabled={loading}
              onChange={(e) => {
                setConfirmText(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder={DELETE_ACCOUNT_CONFIRM_PHRASE}
              className={cn(
                "w-full rounded-[10px] px-3 text-sm",
                textInputFieldClassName,
              )}
            />
          </div>
        </form>
      </AppModalShell>
    </AppModalOverlay>
  );
}
