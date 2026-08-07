import "server-only";

import { sendLoopsTransactionalEmail } from "@/lib/loops/transactional";

/** MoonPay-style login code email — Loops vars: `otpCode`, `firstName`. */
export async function sendLoopsEmailOtpEmail(params: {
  apiKey: string;
  transactionalId: string;
  to: string;
  otpCode: string;
  firstName: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  return sendLoopsTransactionalEmail({
    apiKey: params.apiKey,
    transactionalId: params.transactionalId,
    to: params.to,
    dataVariables: {
      firstName: params.firstName,
      otpCode: params.otpCode,
    },
    errorHint:
      "Check LOOPS_API_KEY, LOOPS_TRANSACTIONAL_ID_EMAIL_OTP, and template variables firstName + otpCode.",
  });
}
