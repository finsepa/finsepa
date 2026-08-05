import "server-only";

import {
  claimProEndedFreeEmailSend,
  clearProEndedFreeEmailClaim,
  resolveUserEmailById,
} from "@/lib/account/billing-db";
import { resolveAuthAppOriginForServer } from "@/lib/auth/app-origin";
import { displayFirstNameFromUser } from "@/lib/auth/display-name";
import { PATH_ACTIVATE_SUBSCRIPTION } from "@/lib/auth/routes";
import { getLoopsApiKey } from "@/lib/env/loops";
import { sendLoopsProEndedFreeEmail } from "@/lib/loops/send-pro-ended-free";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Send Loops “Pro ended — switched to Free” once when paid Pro access fully ends.
 */
export async function trySendLoopsProEndedFreeEmail(args: { userId: string }): Promise<void> {
  const loopsKey = getLoopsApiKey();
  if (!loopsKey) return;

  if (!(await claimProEndedFreeEmailSend(args.userId))) return;

  const admin = getSupabaseAdminClient();
  const userRes = admin ? await admin.auth.admin.getUserById(args.userId) : null;
  const user = userRes?.data?.user ?? null;
  const to =
    (user?.email?.trim() || (await resolveUserEmailById(args.userId)) || "").trim() || null;
  if (!to) {
    await clearProEndedFreeEmailClaim(args.userId);
    console.error("[billing] Pro ended Free email skipped: no recipient for user", args.userId);
    return;
  }

  const firstName = displayFirstNameFromUser(user, to);
  const origin = resolveAuthAppOriginForServer("") || "https://app.finsepa.com";
  const upgradeLink = `${origin}${PATH_ACTIVATE_SUBSCRIPTION}`;

  const sent = await sendLoopsProEndedFreeEmail({
    apiKey: loopsKey,
    to,
    firstName,
    upgradeLink,
  });
  if (!sent.ok) {
    await clearProEndedFreeEmailClaim(args.userId);
    console.error("[billing] Loops Pro ended Free email failed:", sent.message);
  }
}
