import Link from "next/link";

import { AuthCenteredLayout } from "@/components/auth/auth-centered-layout";
import { AuthLegalFooterLinks } from "@/components/auth/auth-continue-legal-notice";
import { authAccentLinkClassName } from "@/components/auth/auth-form-ui";

import { LOGIN_SIGNED_OUT_VALUE } from "@/lib/auth/routes";

import { LoginClient } from "./login-client";

type SearchParams = { reset?: string; error?: string; next?: string; signed_out?: string };

export { authMetadata as metadata, authViewport as viewport } from "@/lib/auth/auth-viewport";

export default async function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const signedOut = sp.signed_out === LOGIN_SIGNED_OUT_VALUE;

  return (
    <AuthCenteredLayout
      split={false}
      title="Log in to your account"
      subtitle={
        <>
          <span className="text-[#5C5D5F]">Not a member yet? </span>
          <Link href="/signup" className={authAccentLinkClassName}>
            Get a free trial
          </Link>
        </>
      }
      preCard={
        signedOut ? (
          <div
            role="status"
            className="rounded-[10px] border border-[#E4E4E7] bg-white px-3 py-2 text-center text-sm leading-5 text-[#52525B] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          >
            You&apos;ve been logged out.
          </div>
        ) : null
      }
      footer={<AuthLegalFooterLinks />}
    >
      <LoginClient
        resetSuccess={sp.reset === "success"}
        callbackError={sp.error ?? null}
        authNext={sp.next ?? null}
        signedOut={signedOut}
      />
    </AuthCenteredLayout>
  );
}
