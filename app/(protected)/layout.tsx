import type { ReactNode } from "react";
import { headers } from "next/headers";

import { getAuthAppOriginFromEnv } from "@/lib/auth/app-origin";
import { sendWelcomeTrialStartEmailIfNeeded } from "@/lib/auth/send-welcome-trial-start-email";
import { shouldSendWelcomeTrialStartEmail } from "@/lib/auth/welcome-trial-start-email";
import { ProtectedAppShell } from "@/components/layout/protected-app-shell";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

function requestOriginFromHeaders(h: Headers): string {
  const fromEnv = getAuthAppOriginFromEnv();
  if (fromEnv) return fromEnv;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return "";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();

  if (sessionUser && shouldSendWelcomeTrialStartEmail(sessionUser)) {
    const welcomeUser = sessionUser;
    const requestOrigin = requestOriginFromHeaders(await headers());
    void (async () => {
      try {
        let user = welcomeUser;
        const admin = getSupabaseAdminClient();
        if (admin) {
          const { data } = await admin.auth.admin.getUserById(welcomeUser.id);
          if (data.user) user = data.user;
        }
        if (!shouldSendWelcomeTrialStartEmail(user)) return;
        const result = await sendWelcomeTrialStartEmailIfNeeded(user, requestOrigin);
        if (!result.sent && result.reason === "send_failed") {
          console.error("[welcome-trial-start]", result.message);
        }
      } catch (err) {
        console.error("[welcome-trial-start]", err);
      }
    })();
  }

  return <ProtectedAppShell>{children}</ProtectedAppShell>;
}
