import "server-only";

import { prepareLoopsTransactionalRecipient } from "@/lib/loops/contacts";
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
  /** First uploaded image — shown inline in the Loops template when set. */
  imageUrl?: string | null;
}): Promise<{ ok: true; to: string } | { ok: false; message: string }> {
  const userEmail = params.userEmail.trim();
  const userName = params.userName.trim() || userEmail.split("@")[0] || "Finsepa user";

  const prepared = await prepareLoopsTransactionalRecipient({
    apiKey: params.apiKey,
    email: SUPPORT_FEEDBACK_TO_EMAIL,
  });
  if (!prepared.ok) {
    console.error("[loops/help-feedback] could not prepare support inbox:", prepared.message);
    return prepared;
  }

  const dataVariables: Record<string, string> = {
    userEmail,
    userName,
    replyToEmail: userEmail,
    senderLabel: `${userName} <${userEmail}>`,
    messageText: params.message,
    pageUrl: params.pageUrl?.trim() || "—",
    attachmentLinks: params.attachmentLinks?.trim() || "None",
  };
  const imageUrl = params.imageUrl?.trim();
  if (imageUrl) {
    dataVariables.imageUrl = imageUrl;
  }

  const errorHint =
    "Check LOOPS_API_KEY, LOOPS_TRANSACTIONAL_ID_HELP_FEEDBACK, and template: publish it, From = hello@mail.finsepa.com, Reply-To = {data.userEmail}, LMX tags {data.userName}, optional {data.imageUrl}.";

  const result = await sendLoopsTransactionalEmail({
    apiKey: params.apiKey,
    transactionalId: params.transactionalId,
    to: SUPPORT_FEEDBACK_TO_EMAIL,
    addContact: false,
    dataVariables,
    errorHint,
  });

  if (!result.ok && imageUrl) {
    console.warn("[loops/help-feedback] retrying without inline image:", result.message);
    const withoutImage: Record<string, string> = { ...dataVariables };
    delete withoutImage.imageUrl;
    const retry = await sendLoopsTransactionalEmail({
      apiKey: params.apiKey,
      transactionalId: params.transactionalId,
      to: SUPPORT_FEEDBACK_TO_EMAIL,
      addContact: false,
      dataVariables: withoutImage,
      errorHint,
    });
    if (retry.ok) return { ok: true, to: SUPPORT_FEEDBACK_TO_EMAIL };
    return retry;
  }

  if (!result.ok) return result;
  return { ok: true, to: SUPPORT_FEEDBACK_TO_EMAIL };
}
