import "server-only";

import { pickProcessEnv } from "@/lib/env/pick-process-env";

function envTruthy(name: string): boolean {
  const v = pickProcessEnv(name);
  return v === "1" || v?.toLowerCase() === "true";
}

/**
 * Server: email OTP APIs enabled.
 * Prefer `AUTH_EMAIL_OTP`; `NEXT_PUBLIC_AUTH_EMAIL_OTP` also counts so local UI+API share one switch.
 */
export function isEmailOtpEnabledServer(): boolean {
  return envTruthy("AUTH_EMAIL_OTP") || envTruthy("NEXT_PUBLIC_AUTH_EMAIL_OTP");
}
