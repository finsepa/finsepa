"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { AuthPrimaryButton } from "@/components/auth/auth-form-ui";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const COOLDOWN_SECONDS = 60;

export function CheckEmailClient({ email }: { email: string | null }) {
  const [secondsLeft, setSecondsLeft] = useState(COOLDOWN_SECONDS);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const canResend = secondsLeft <= 0 && !loading;

  const buttonLabel = useMemo(() => {
    if (!canResend) return `Resend Email in ${Math.max(0, secondsLeft)}s`;
    return "Resend Email";
  }, [canResend, secondsLeft]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = window.setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [secondsLeft]);

  async function handleResend() {
    setStatus(null);
    setLoading(true);
    try {
      if (!email) {
        setStatus("Add your email to resend: try signing up again.");
        setSecondsLeft(COOLDOWN_SECONDS);
        return;
      }

      const supabase = getSupabaseBrowserClient();
      // Supabase v2 supports resending confirmation emails.
      // If your project uses a different confirmation flow, this will safely error and we still keep the UX.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.auth as any).resend({ type: "signup", email });
      if (error) {
        setStatus(error.message);
      } else {
        setStatus("Confirmation email sent again.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setStatus(message);
    } finally {
      setLoading(false);
      setSecondsLeft(COOLDOWN_SECONDS);
    }
  }

  return (
    <div className="space-y-4">
      {status ? (
        <div className="rounded-[10px] border border-[#E4E4E7] bg-[#FAFAFA] px-3 py-2 text-sm leading-6 text-[#52525B]">
          {status}
        </div>
      ) : null}

      <AuthPrimaryButton type="button" disabled={!canResend} onClick={handleResend as unknown as () => void}>
        {loading ? "Sending…" : buttonLabel}
      </AuthPrimaryButton>

      <div className="text-center">
        <Link
          href="/login"
          className="text-sm font-semibold text-[#09090B] underline decoration-[#E4E4E7] underline-offset-4 transition-colors hover:decoration-[#A1A1AA]"
        >
          Back to Log In
        </Link>
      </div>
    </div>
  );
}

