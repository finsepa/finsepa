import "server-only";

import type { User } from "@supabase/supabase-js";

import { requestOriginFromHeaders } from "@/lib/auth/request-origin";
import { sendWelcomeTrialStartEmailIfNeeded } from "@/lib/auth/send-welcome-trial-start-email";
import { shouldSendWelcomeTrialStartEmail } from "@/lib/auth/welcome-trial-start-email";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/** Fire-and-forget welcome email after session is established (never blocks render). */
export function scheduleWelcomeTrialStartEmailIfNeeded(user: User, requestOrigin: string): void {
  if (!shouldSendWelcomeTrialStartEmail(user)) return;

  const welcomeUser = user;
  void (async () => {
    try {
      let resolved = welcomeUser;
      const admin = getSupabaseAdminClient();
      if (admin) {
        const { data } = await admin.auth.admin.getUserById(welcomeUser.id);
        if (data.user) resolved = data.user;
      }
      if (!shouldSendWelcomeTrialStartEmail(resolved)) return;
      const result = await sendWelcomeTrialStartEmailIfNeeded(resolved, requestOrigin);
      if (!result.sent && result.reason === "send_failed") {
        console.error("[welcome-trial-start]", result.message);
      }
    } catch (err) {
      console.error("[welcome-trial-start]", err);
    }
  })();
}

export function scheduleWelcomeTrialStartEmailFromHeaders(user: User, headers: Headers): void {
  scheduleWelcomeTrialStartEmailIfNeeded(user, requestOriginFromHeaders(headers));
}
