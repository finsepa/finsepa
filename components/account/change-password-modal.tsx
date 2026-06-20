"use client";

import { useEffect, useId, useState, type FormEvent } from "react";

import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import {
  AppModalFooter,
  AppModalShell,
  appModalCancelButtonClass,
  appModalPrimaryButtonClass,
} from "@/components/ui/app-modal-shell";
import { requestPasswordResetEmail } from "@/lib/auth/request-password-reset";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fieldClass =
  "h-10 w-full rounded-[10px] border border-[#E4E4E7] bg-[#F9FAFB] px-3 text-sm text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)] outline-none transition-all duration-100 placeholder:text-[#A1A1AA] focus:border-[#D4D4D8] focus:bg-white focus:shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06),0_0_0_4px_rgba(9,9,11,0.06)]";

const readOnlyFieldClass =
  "h-10 w-full cursor-default rounded-[10px] border border-[#E4E4E7] bg-[#F4F4F5] px-3 text-sm text-[#71717A] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)] outline-none";

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-[#09090B]">
      {children}
    </label>
  );
}

export function ChangePasswordModal({
  open,
  onClose,
  defaultEmail,
}: {
  open: boolean;
  onClose: () => void;
  defaultEmail: string;
}) {
  const titleId = useId();
  const [email, setEmail] = useState(defaultEmail);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const emailReady = email.trim().length > 0 && EMAIL_RE.test(email.trim());

  useEffect(() => {
    if (!open) return;
    setEmail(defaultEmail);
    setLoading(false);
    setSent(false);
    setErrorMessage(null);
  }, [open, defaultEmail]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const result = await requestPasswordResetEmail(email);
      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }
      setSent(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <AppModalOverlay open={open} onClose={onClose} zIndex={260}>
      <AppModalShell
        titleId={titleId}
        title="Change password"
        onClose={onClose}
        bodyClassName="space-y-4 px-5 py-5"
        footer={
          sent ? (
            <AppModalFooter className="justify-end">
              <button type="button" onClick={onClose} className={appModalPrimaryButtonClass(true)}>
                Done
              </button>
            </AppModalFooter>
          ) : (
            <AppModalFooter className="justify-end gap-2">
              <button type="button" onClick={onClose} disabled={loading} className={appModalCancelButtonClass}>
                Cancel
              </button>
              <button
                type="submit"
                form="change-password-form"
                disabled={loading || !emailReady}
                className={appModalPrimaryButtonClass(!loading && emailReady)}
              >
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </AppModalFooter>
          )
        }
      >
        {sent ? (
          <div
            role="status"
            className="rounded-[10px] border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-3 text-sm leading-6 text-[#166534]"
          >
            Check your email for reset instructions. When you open the link, you&apos;ll set a new password on the
            same screen used from login.
          </div>
        ) : (
          <form id="change-password-form" className="space-y-4" onSubmit={handleSubmit} noValidate>
            <p className="text-sm leading-6 text-[#71717A]">
              We&apos;ll email you a link to set a new password.
            </p>

            {errorMessage ? (
              <div
                role="alert"
                className="rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-sm leading-5 text-[#B91C1C]"
              >
                {errorMessage}
              </div>
            ) : null}

            <div>
              <FieldLabel htmlFor="change-password-email">Email</FieldLabel>
              <input
                id="change-password-email"
                type="email"
                name="email"
                value={email}
                readOnly={!!defaultEmail}
                aria-readonly={!!defaultEmail}
                onChange={(e) => setEmail(e.target.value)}
                className={defaultEmail ? readOnlyFieldClass : fieldClass}
                autoComplete="email"
                required
                disabled={loading}
              />
            </div>
          </form>
        )}
      </AppModalShell>
    </AppModalOverlay>
  );
}
