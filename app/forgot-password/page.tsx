import Link from "next/link";
import { ForgotPasswordClient } from "./forgot-password-client";
import { AuthCenteredLayout } from "@/components/auth/auth-centered-layout";
import { AuthLegalFooterLinks } from "@/components/auth/auth-continue-legal-notice";
import { authAccentLinkClassName } from "@/components/auth/auth-form-ui";
import { PATH_LOGIN } from "@/lib/auth/routes";

export { authMetadata as metadata, authViewport as viewport } from "@/lib/auth/auth-viewport";

export default function ForgotPasswordPage() {
  return (
    <AuthCenteredLayout
      split={false}
      title="Reset your password"
      subtitle={
        <>
          <span className="text-[#71717A]">Remember your password? </span>
          <Link href={PATH_LOGIN} className={authAccentLinkClassName}>
            Log in
          </Link>
        </>
      }
      footer={<AuthLegalFooterLinks />}
    >
      <ForgotPasswordClient />
    </AuthCenteredLayout>
  );
}
