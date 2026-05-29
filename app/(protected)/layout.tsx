import type { ReactNode } from "react";
import { headers } from "next/headers";
import { after } from "next/server";

import { getAuthAppOriginFromEnv } from "@/lib/auth/app-origin";
import { sendGoogleWelcomeEmailIfNeeded } from "@/lib/auth/send-google-welcome-email";
import { shouldSendGoogleWelcomeEmail } from "@/lib/auth/google-welcome-email";
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

  if (sessionUser) {
    after(async () => {
      let user = sessionUser;
      const admin = getSupabaseAdminClient();
      if (admin) {
        const { data } = await admin.auth.admin.getUserById(sessionUser.id);
        if (data.user) user = data.user;
      }
      if (!shouldSendGoogleWelcomeEmail(user)) return;
      const h = await headers();
      await sendGoogleWelcomeEmailIfNeeded(user, requestOriginFromHeaders(h));
    });
  }

  return <ProtectedAppShell>{children}</ProtectedAppShell>;
}
