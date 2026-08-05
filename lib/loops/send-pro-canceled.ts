import "server-only";

import { getLoopsTransactionalProCanceledId } from "@/lib/env/server";
import { sendLoopsTransactionalEmail } from "@/lib/loops/transactional";

/**
 * “Your Finsepa Pro subscription is canceled” — Stripe portal cancel at period end.
 * Template data variables: firstName, daysRemaining (e.g. "14 days"), accessEndsAt, billingLink.
 * Button href in Loops: `{data.billingLink}`
 */
export async function sendLoopsProCanceledEmail(params: {
  apiKey: string;
  to: string;
  firstName: string;
  /** Human label such as "14 days" or "1 day". */
  daysRemaining: string;
  /** e.g. "Sep 5, 2026" */
  accessEndsAt: string;
  billingLink: string;
  transactionalId?: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  return sendLoopsTransactionalEmail({
    apiKey: params.apiKey,
    transactionalId: params.transactionalId ?? getLoopsTransactionalProCanceledId(),
    to: params.to,
    dataVariables: {
      firstName: params.firstName,
      daysRemaining: params.daysRemaining,
      accessEndsAt: params.accessEndsAt,
      billingLink: params.billingLink,
    },
    errorHint:
      "Check LOOPS_API_KEY, LOOPS_TRANSACTIONAL_ID_PRO_CANCELED, and template variables firstName, daysRemaining, accessEndsAt, billingLink.",
  });
}
