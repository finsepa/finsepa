import "server-only";

import { getLoopsTransactionalProEndedFreeId } from "@/lib/env/server";
import { sendLoopsTransactionalEmail } from "@/lib/loops/transactional";

/**
 * “Your Finsepa Pro access has ended” — paid Pro finished; account is on Free.
 * Template variables: firstName, upgradeLink.
 * Button href in Loops: `{data.upgradeLink}`
 */
export async function sendLoopsProEndedFreeEmail(params: {
  apiKey: string;
  to: string;
  firstName: string;
  upgradeLink: string;
  transactionalId?: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  return sendLoopsTransactionalEmail({
    apiKey: params.apiKey,
    transactionalId: params.transactionalId ?? getLoopsTransactionalProEndedFreeId(),
    to: params.to,
    dataVariables: {
      firstName: params.firstName,
      upgradeLink: params.upgradeLink,
    },
    errorHint:
      "Check LOOPS_API_KEY, LOOPS_TRANSACTIONAL_ID_PRO_ENDED_FREE, and template variables firstName, upgradeLink.",
  });
}
