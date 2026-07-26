const TERMS_OF_SERVICE_URL = "https://www.finsepa.com/terms-of-service";
const PRIVACY_POLICY_URL = "https://www.finsepa.com/privacy-policy";

const linkClassName =
  "font-medium text-[#5C5D5F] underline decoration-[#D4D4D8] underline-offset-4 transition-colors hover:text-[#141414] hover:decoration-[#A1A1AA]";

const footerLinkClassName =
  "text-[#5C5D5F] transition-colors hover:text-[#141414]";

export function AuthContinueLegalNotice() {
  return (
    <p className="text-center text-[12px] leading-4 text-[#5C5D5F]">
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

/** Compact footer for login / signup / forgot-password: Terms of service · Privacy Policy */
export function AuthLegalFooterLinks() {
  return (
    <p className="text-center text-[12px] leading-4 text-[#5C5D5F]">
      <a
        href={TERMS_OF_SERVICE_URL}
        className={footerLinkClassName}
        target="_blank"
        rel="noopener noreferrer"
      >
        Terms of service
      </a>
      <span aria-hidden className="mx-1.5">
        ·
      </span>
      <a
        href={PRIVACY_POLICY_URL}
        className={footerLinkClassName}
        target="_blank"
        rel="noopener noreferrer"
      >
        Privacy Policy
      </a>
    </p>
  );
}
