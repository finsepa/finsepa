import "server-only";

import { sendLoopsTransactionalEmail } from "@/lib/loops/transactional";
import { SUPPORT_FEEDBACK_TO_EMAIL } from "@/lib/support/feedback-constants";

export async function sendHelpFeedbackEmail(params: {
  apiKey: string;
  transactionalId: string;
  userEmail: string;
  userName: string;
  message: string;
  pageUrl?: string | null;
  attachmentLinks?: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  return sendLoopsTransactionalEmail({
    apiKey: params.apiKey,
    transactionalId: params.transactionalId,
    to: SUPPORT_FEEDBACK_TO_EMAIL,
    addContact: false,
    dataVariables: {
      userEmail: params.userEmail,
      userName: params.userName,
      messageText: params.message,
      pageUrl: params.pageUrl?.trim() || "—",
      attachmentLinks: params.attachmentLinks?.trim() || "None",
    },
    errorHint:
      "Check LOOPS_API_KEY, LOOPS_TRANSACTIONAL_ID_HELP_FEEDBACK, and template variables userEmail, userName, messageText, pageUrl, attachmentLinks.",
  });
}
