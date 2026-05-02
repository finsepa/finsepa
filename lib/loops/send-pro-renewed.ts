import "server-only";

import { getLoopsTransactionalProRenewedId } from "@/lib/env/server";
import { sendLoopsTransactionalEmail } from "@/lib/loops/transactional";

/** “Your Finsepa Pro has been renewed” — triggered after each successful recurring Pro invoice (Stripe webhook). */
export async function sendLoopsProRenewedEmail(params: {
  apiKey: string;
  to: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  return sendLoopsTransactionalEmail({
    apiKey: params.apiKey,
    transactionalId: getLoopsTransactionalProRenewedId(),
    to: params.to,
    errorHint:
      "Check LOOPS_API_KEY, LOOPS_TRANSACTIONAL_ID_PRO_RENEWED, and Loops transactional template.",
  });
}
