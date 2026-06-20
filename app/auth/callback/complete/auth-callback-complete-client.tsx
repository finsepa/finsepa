"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { postWelcomeTrialStartFromSession } from "@/lib/auth/send-welcome-trial-start-from-session";
import { PATH_APP_ENTRY } from "@/lib/auth/routes";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const REDIRECT_AFTER_SUCCESS_MS = 900;

function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return PATH_APP_ENTRY;
  return raw;
}

function goTo(path: string) {
  window.location.replace(path);
}

function StatusBanner({
  tone,
  message,
}: {
  tone: "success" | "error" | "working";
  message: string;
}) {
  if (tone === "success") {
    return (
      <div
        role="status"
        className="rounded-[10px] border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-2.5 text-center text-sm font-medium leading-5 text-[#166534] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
      >
        {message}
      </div>
    );
  }

  if (tone === "error") {
    return (
      <div
        role="alert"
        className="rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] px-3 py-2.5 text-center text-sm leading-5 text-[#B91C1C]"
      >
        {message}
      </div>
    );
  }

  return (
    <div
      role="status"
      className="rounded-[10px] border border-[#E4E4E7] bg-[#FAFAFA] px-3 py-2.5 text-center text-sm leading-5 text-[#52525B]"
    >
      {message}
    </div>
  );
}

function AuthCallbackCompleteInner() {
  const searchParams = useSearchParams();
  const [tone, setTone] = useState<"success" | "error" | "working">("working");
  const [message, setMessage] = useState("Finishing your sign-in…");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const destination = safeNextPath(searchParams.get("next"));

      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          setTone("error");
          setMessage("Your session could not be restored. Redirecting to login…");
          await new Promise((r) => setTimeout(r, REDIRECT_AFTER_SUCCESS_MS));
          if (!cancelled) goTo("/login?error=session");
          return;
        }

        setTone("success");
        setMessage("You're in! Redirecting to Finsepa…");

        try {
          await postWelcomeTrialStartFromSession();
        } catch {
          /* non-blocking */
        }

        await new Promise((r) => setTimeout(r, REDIRECT_AFTER_SUCCESS_MS));
        if (!cancelled) goTo(destination);
      } catch {
        setTone("error");
        setMessage("Something went wrong. Redirecting to login…");
        await new Promise((r) => setTimeout(r, REDIRECT_AFTER_SUCCESS_MS));
        if (!cancelled) goTo("/login?error=session");
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return <StatusBanner tone={tone} message={message} />;
}

export function AuthCallbackCompleteClient() {
  return (
    <Suspense fallback={<StatusBanner tone="working" message="Finishing your sign-in…" />}>
      <AuthCallbackCompleteInner />
    </Suspense>
  );
}
