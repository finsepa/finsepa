import "server-only";

import { getSupportFeedbackToEmail } from "@/lib/env/server";
import { sendLoopsTransactionalEmail } from "@/lib/loops/transactional";

export async function sendHelpFeedbackEmail(params: {
  apiKey: string;
  transactionalId: string;
  userEmail: string;
  userName: string;
  message: string;
  pageUrl?: string | null;
  attachmentLinks?: string | null;
}): Promise<{ ok: true; to: string } | { ok: false; message: string }> {
  const to = getSupportFeedbackToEmail();
  const result = await sendLoopsTransactionalEmail({
    apiKey: params.apiKey,
    transactionalId: params.transactionalId,
    to,
    addContact: false,
    dataVariables: {
      userEmail: params.userEmail,
      userName: params.userName,
      messageText: params.message,
      pageUrl: params.pageUrl?.trim() || "—",
      attachmentLinks: params.attachmentLinks?.trim() || "None",
    },
    errorHint:
      "Check LOOPS_API_KEY, LOOPS_TRANSACTIONAL_ID_HELP_FEEDBACK, SUPPORT_FEEDBACK_TO_EMAIL, and template variables userEmail, userName, messageText, pageUrl, attachmentLinks.",
  });
  if (!result.ok) return result;
  return { ok: true, to };
}
