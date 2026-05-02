import "server-only";

import { getLoopsTransactionalProActivatedId } from "@/lib/env/server";
import { sendLoopsTransactionalEmail } from "@/lib/loops/transactional";

/** “Your Finsepa Pro is now active” — triggered after first successful Pro subscription payment (Stripe webhook). */
export async function sendLoopsProActivatedEmail(params: {
  apiKey: string;
  to: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  return sendLoopsTransactionalEmail({
    apiKey: params.apiKey,
    transactionalId: getLoopsTransactionalProActivatedId(),
    to: params.to,
    errorHint:
      "Check LOOPS_API_KEY, LOOPS_TRANSACTIONAL_ID_PRO_ACTIVATED, and Loops transactional template.",
  });
}
