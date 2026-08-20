import "server-only";

import { getLoopsTransactionalWelcomeTrialStartId } from "@/lib/env/server";
import { sendLoopsTransactionalEmail } from "@/lib/loops/transactional";

/**
 * Signup welcome (Google / Apple / email OTP after confirm).
 * Loops template data variables: firstName, platformLink.
 *
 * Button href in Loops must use transactional syntax: `{data.platformLink}`
 * (same as `{data.confirmationLink}` on sign-up / password-reset templates — not `{{data.platformLink}}`).
 * @see https://loops.so/docs/transactional
 */
export async function sendLoopsWelcomeTrialStartEmail(params: {
  apiKey: string;
  to: string;
  firstName: string;
  platformLink: string;
  transactionalId?: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  return sendLoopsTransactionalEmail({
    apiKey: params.apiKey,
    transactionalId: params.transactionalId ?? getLoopsTransactionalWelcomeTrialStartId(),
    to: params.to,
    dataVariables: {
      firstName: params.firstName,
      platformLink: params.platformLink,
    },
    errorHint:
      "Check LOOPS_API_KEY, LOOPS_TRANSACTIONAL_ID_WELCOME_TRIAL_START, template variables, and button href {data.platformLink} in Loops.",
  });
}
