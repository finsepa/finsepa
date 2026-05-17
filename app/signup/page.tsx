import Link from "next/link";
import { AuthCenteredLayout } from "@/components/auth/auth-centered-layout";
import { AuthContinueLegalNotice } from "@/components/auth/auth-continue-legal-notice";
import { authAccentLinkClassName } from "@/components/auth/auth-form-ui";
import { SignupClientDynamic } from "./signup-client-dynamic";

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#E4E4E7" },
    { media: "(prefers-color-scheme: dark)", color: "#E4E4E7" },
  ],
};

export default function SignupPage() {
  return (
    <AuthCenteredLayout
      title="Start your free trial"
      subtitle={
        <>
          <span className="text-[#71717A]">Already have an account? </span>
          <Link href="/login" className={authAccentLinkClassName}>
            Log in
          </Link>
        </>
      }
      footer={<AuthContinueLegalNotice />}
    >
      <SignupClientDynamic />
    </AuthCenteredLayout>
  );
}
