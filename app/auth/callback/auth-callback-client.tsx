"use client";

import { createClient } from "@supabase/supabase-js";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { PATH_APP_ENTRY } from "@/lib/auth/routes";
import { parseAuthCallbackParams } from "@/lib/auth/parse-auth-callback-url";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

function safeNextPath(raw: string | null | undefined): string {
  const fallback = PATH_APP_ENTRY;
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return fallback;
  return raw;
}

/** Full navigation avoids Next.js soft-navigation RSC fetch failures after auth (common in dev / Turbopack). */
function goTo(path: string) {
  window.location.replace(path);
}

function AuthCallbackInner() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Signing you in…");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const href = window.location.href;
      const params = parseAuthCallbackParams(href);

      const nextFromQuery = searchParams.get("next");
      const nextFromParams = params.next;
      const nextRaw = nextFromQuery ?? nextFromParams;
      const safeNext = safeNextPath(nextRaw);

      if (params.error || params.error_description) {
        goTo(`/login?error=session`);
        return;
      }

      const supabase = getSupabaseBrowserClient();

      const token_hash = params.token_hash;
      const typeRaw = params.type;
      if (token_hash && typeRaw) {
        setMessage("Confirming your email…");
        const { error } = await supabase.auth.verifyOtp({
          token_hash,
          type: typeRaw as "signup" | "invite" | "magiclink" | "recovery" | "email_change" | "email",
        });
        if (!cancelled && !error) {
          goTo(safeNext);
          return;
        }
        if (!cancelled && error) {
          goTo(`/login?error=session`);
          return;
        }
      }

      if (params.access_token && params.refresh_token) {
        setMessage("Signing you in…");
        const { error } = await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });
        if (!cancelled && !error) {
          goTo(safeNext);
          return;
        }
      }

      const code = params.code;
      if (code) {
        setMessage("Signing you in…");
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!cancelled && !error) {
          goTo(safeNext);
          return;
        }
      }

      const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
      if (url && key) {
        setMessage("Signing you in…");
        const implicit = createClient(url, key, {
          auth: {
            flowType: "implicit",
            autoRefreshToken: true,
            persistSession: false,
            detectSessionInUrl: true,
          },
        });
        await implicit.auth.initialize();
        const {
          data: { session: implicitSession },
        } = await implicit.auth.getSession();
        if (implicitSession && !cancelled) {
          const { error } = await supabase.auth.setSession({
            access_token: implicitSession.access_token,
            refresh_token: implicitSession.refresh_token,
          });
          if (!error) {
            goTo(safeNext);
            return;
          }
        }
      }

      if (!cancelled) {
        goTo(`/login?error=missing_code`);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return (
    <p className="text-center text-xs leading-4 text-[#71717A]" role="status" aria-live="polite">
      {message}
    </p>
  );
}

export function AuthCallbackClient() {
  return (
    <Suspense
      fallback={<p className="text-center text-xs text-[#71717A]">Loading…</p>}
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
