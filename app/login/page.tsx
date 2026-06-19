import Link from "next/link";

import { AuthCenteredLayout } from "@/components/auth/auth-centered-layout";
import { authAccentLinkClassName } from "@/components/auth/auth-form-ui";

import { LoginClient } from "./login-client";

type SearchParams = { reset?: string; error?: string; next?: string };

export { authMetadata as metadata, authViewport as viewport } from "@/lib/auth/auth-viewport";

export default async function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;

  return (
    <AuthCenteredLayout
      split={false}
      title="Log in to your account"
      subtitle={
        <>
          <span className="text-[#71717A]">Not a member yet? </span>
          <Link href="/signup" className={authAccentLinkClassName}>
            Get a free trial
          </Link>
        </>
      }
      footer={
        <p className="text-[12px] leading-4 text-[#71717A]">
          Finsepa provides tools for research and portfolio tracking. We do not provide investment advice.
        </p>
      }
    >
      <LoginClient
        resetSuccess={sp.reset === "success"}
        callbackError={sp.error ?? null}
        authNext={sp.next ?? null}
      />
    </AuthCenteredLayout>
  );
}
