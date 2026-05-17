const TERMS_OF_SERVICE_URL = "https://www.finsepa.com/terms-of-service";
const PRIVACY_POLICY_URL = "https://www.finsepa.com/privacy-policy";

const linkClassName =
  "font-medium text-[#71717A] underline decoration-[#D4D4D8] underline-offset-4 transition-colors hover:text-[#09090B] hover:decoration-[#A1A1AA]";

export function AuthContinueLegalNotice() {
  return (
    <p className="text-center text-[12px] leading-4 text-[#71717A]">
      By continuing, you agree to Finsepa&apos;s{" "}
      <a href={TERMS_OF_SERVICE_URL} className={linkClassName} target="_blank" rel="noopener noreferrer">
        Terms of Service
      </a>{" "}
      and{" "}
      <a href={PRIVACY_POLICY_URL} className={linkClassName} target="_blank" rel="noopener noreferrer">
        Privacy Policy
      </a>
      .
    </p>
  );
}
