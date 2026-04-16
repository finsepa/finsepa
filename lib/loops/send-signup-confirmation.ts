import "server-only";

import { sendLoopsTransactionalAuthEmail } from "@/lib/loops/transactional";

export async function sendLoopsSignupConfirmationEmail(params: {
  apiKey: string;
  transactionalId: string;
  to: string;
  confirmationLink: string;
  firstName: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  return sendLoopsTransactionalAuthEmail({
    ...params,
    errorHint:
      "Check LOOPS_API_KEY, LOOPS_TRANSACTIONAL_ID_SIGNUP, and template variables firstName + confirmationLink.",
  });
}
