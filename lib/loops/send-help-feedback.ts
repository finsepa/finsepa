import "server-only";

import { sendLoopsTransactionalEmail } from "@/lib/loops/transactional";
import { SUPPORT_FEEDBACK_TO_EMAIL } from "@/lib/support/feedback-constants";

/**
 * Notify Finsepa support via Loops transactional.
 *
 * Loops API `email` is the **recipient** (always hi@finsepa.com). The user's address
 * cannot be the SMTP From (Gmail etc. are not verified in Loops) — bind template
 * **Reply-To** to `{{userEmail}}` so replies go to the person who submitted the form.
 * Use a verified sending domain for **From** (e.g. hello@mail.finsepa.com), not hi@.
 */
export async function sendHelpFeedbackEmail(params: {
  apiKey: string;
  transactionalId: string;
  userEmail: string;
  userName: string;
  message: string;
  pageUrl?: string | null;
  attachmentLinks?: string | null;
}): Promise<{ ok: true; to: string } | { ok: false; message: string }> {
  const userEmail = params.userEmail.trim();
  const userName = params.userName.trim() || userEmail.split("@")[0] || "Finsepa user";

  const result = await sendLoopsTransactionalEmail({
    apiKey: params.apiKey,
    transactionalId: params.transactionalId,
    to: SUPPORT_FEEDBACK_TO_EMAIL,
    addContact: false,
    dataVariables: {
      userEmail,
      userName,
      replyToEmail: userEmail,
      senderLabel: `${userName} <${userEmail}>`,
      messageText: params.message,
      pageUrl: params.pageUrl?.trim() || "—",
      attachmentLinks: params.attachmentLinks?.trim() || "None",
    },
    errorHint:
      "Check LOOPS_API_KEY, LOOPS_TRANSACTIONAL_ID_HELP_FEEDBACK, and template: publish it, From = verified domain, Reply-To = {{userEmail}}, variables userEmail, userName, replyToEmail, senderLabel, messageText, pageUrl, attachmentLinks.",
  });
  if (!result.ok) return result;
  return { ok: true, to: SUPPORT_FEEDBACK_TO_EMAIL };
}
