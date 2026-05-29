import "server-only";

import { getLoopsTransactionalGoogleWelcomeId } from "@/lib/env/server";
import { sendLoopsTransactionalEmail } from "@/lib/loops/transactional";

/**
 * Welcome email after Google sign-up (no confirmation link).
 * Loops template data variables: firstName, platformLink, trialDays, trialEndsAt, proInfoLine.
 */
export async function sendLoopsGoogleWelcomeEmail(params: {
  apiKey: string;
  to: string;
  firstName: string;
  platformLink: string;
  trialDays: number;
  trialEndsAt: string;
  proInfoLine: string;
  transactionalId?: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  return sendLoopsTransactionalEmail({
    apiKey: params.apiKey,
    transactionalId: params.transactionalId ?? getLoopsTransactionalGoogleWelcomeId(),
    to: params.to,
    dataVariables: {
      firstName: params.firstName,
      platformLink: params.platformLink,
      trialDays: params.trialDays,
      trialEndsAt: params.trialEndsAt,
      proInfoLine: params.proInfoLine,
    },
    errorHint:
      "Check LOOPS_API_KEY, LOOPS_TRANSACTIONAL_ID_GOOGLE_WELCOME, and template variables firstName, platformLink, trialDays, trialEndsAt, proInfoLine.",
  });
}
