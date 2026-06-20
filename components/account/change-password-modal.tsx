"use client";

import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { AuthPasswordInput } from "@/components/auth/auth-password-input";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import {
  AppModalFooter,
  AppModalShell,
  appModalCancelButtonClass,
  appModalPrimaryButtonClass,
} from "@/components/ui/app-modal-shell";
import { changePasswordWithCurrent, MIN_PASSWORD_LENGTH } from "@/lib/auth/change-password";

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-[#09090B]">
      {children}
    </label>
  );
}

const passwordFieldClass =
  "h-10 max-h-10 rounded-[10px] border border-[#E4E4E7] bg-[#F9FAFB] py-2 pl-3 pr-[34px] text-sm text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)] outline-none transition-all duration-100 placeholder:text-[#A1A1AA] focus:border-[#D4D4D8] focus:bg-white focus:shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06),0_0_0_4px_rgba(9,9,11,0.06)] disabled:cursor-not-allowed disabled:opacity-60";

export function ChangePasswordModal({
  open,
  onClose,
  email,
}: {
  open: boolean;
  onClose: () => void;
  email: string;
}) {
  const titleId = useId();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const samePasswordError = useMemo(() => {
    if (!currentPassword || !newPassword) return null;
    if (currentPassword === newPassword) {
      return "New password must be different from your current password.";
    }
    return null;
  }, [currentPassword, newPassword]);

  const canSave = useMemo(() => {
    if (loading) return false;
    if (!currentPassword || !newPassword) return false;
    if (newPassword.length < MIN_PASSWORD_LENGTH) return false;
    if (currentPassword === newPassword) return false;
    return true;
  }, [currentPassword, loading, newPassword]);

  useEffect(() => {
    if (!open) return;
    setCurrentPassword("");
    setNewPassword("");
    setLoading(false);
    setErrorMessage(null);
  }, [open]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    if (currentPassword === newPassword) {
      setErrorMessage("New password must be different from your current password.");
      return;
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const result = await changePasswordWithCurrent({
        email,
        currentPassword,
        newPassword,
      });

      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }

      toast.success("Password updated.");
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  const displayError = errorMessage ?? samePasswordError;

  return (
    <AppModalOverlay open={open} onClose={onClose} zIndex={260}>
      <AppModalShell
        titleId={titleId}
        title="Change password"
        onClose={onClose}
        bodyClassName="space-y-4 px-5 py-5"
        footer={
          <AppModalFooter className="justify-end gap-2">
            <button type="button" onClick={onClose} disabled={loading} className={appModalCancelButtonClass}>
              Cancel
            </button>
            <button
              type="submit"
              form="change-password-form"
              disabled={!canSave}
              className={appModalPrimaryButtonClass(canSave)}
            >
              {loading ? "Saving…" : "Save changes"}
            </button>
          </AppModalFooter>
        }
      >
        <form id="change-password-form" className="space-y-4" onSubmit={handleSubmit} noValidate>
          {displayError ? (
            <div
              role="alert"
              className="rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-sm leading-5 text-[#B91C1C]"
            >
              {displayError}
            </div>
          ) : null}

          <div>
            <FieldLabel htmlFor="change-password-current">Current password</FieldLabel>
            <AuthPasswordInput
              id="change-password-current"
              name="currentPassword"
              autoComplete="current-password"
              placeholder="Enter your current password"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              className={passwordFieldClass}
              disabled={loading}
            />
          </div>

          <div>
            <FieldLabel htmlFor="change-password-new">New password</FieldLabel>
            <AuthPasswordInput
              id="change-password-new"
              name="newPassword"
              autoComplete="new-password"
              placeholder="Enter your new password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              minLength={MIN_PASSWORD_LENGTH}
              className={passwordFieldClass}
              disabled={loading}
            />
          </div>
        </form>
      </AppModalShell>
    </AppModalOverlay>
  );
}
