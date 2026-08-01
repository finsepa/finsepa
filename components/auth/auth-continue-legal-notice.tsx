const TERMS_OF_SERVICE_URL = "https://www.finsepa.com/terms-of-service";
const PRIVACY_POLICY_URL = "https://www.finsepa.com/privacy-policy";

const linkClassName =
  "font-medium text-fg-muted underline decoration-stroke underline-offset-4 transition-colors hover:text-fg hover:decoration-fg-subtle";

const footerLinkClassName =
  "text-fg-muted transition-colors hover:text-fg";

export function AuthContinueLegalNotice() {
  return (
    <p className="text-center text-[12px] leading-4 text-fg-muted">
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
    <p className="text-center text-[12px] leading-4 text-fg-muted">
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
