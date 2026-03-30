import Link from "next/link";
import { LoginClient } from "./login-client";
import { AuthCenteredLayout } from "@/components/auth/auth-centered-layout";

type SearchParams = { reset?: string; error?: string };

export default async function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  return (
    <AuthCenteredLayout
      title="Log in to your account"
      subtitle={
        <>
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-semibold underline decoration-[#E4E4E7] underline-offset-4 transition-colors hover:decoration-[#A1A1AA]"
          >
            Sign up
          </Link>
        </>
      }
    >
      <LoginClient resetSuccess={sp.reset === "success"} callbackError={sp.error ?? null} />
    </AuthCenteredLayout>
  );
}
