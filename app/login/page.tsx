import Link from "next/link";

import { AuthCenteredLayout } from "@/components/auth/auth-centered-layout";
import { authAccentLinkClassName } from "@/components/auth/auth-form-ui";

import { LoginClient } from "./login-client";

type SearchParams = { reset?: string; error?: string };

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#E4E4E7" },
    { media: "(prefers-color-scheme: dark)", color: "#E4E4E7" },
  ],
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;

  return (
    <AuthCenteredLayout
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
      <LoginClient resetSuccess={sp.reset === "success"} callbackError={sp.error ?? null} />
    </AuthCenteredLayout>
  );
}
