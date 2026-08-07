/** Browser-safe OTP UI flag (`NEXT_PUBLIC_*` only — no server-only imports). */
export function isEmailOtpEnabledClient(): boolean {
  const v = process.env.NEXT_PUBLIC_AUTH_EMAIL_OTP?.trim();
  return v === "1" || v?.toLowerCase() === "true";
}
