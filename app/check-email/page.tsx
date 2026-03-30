import { AuthCenteredLayout } from "@/components/auth/auth-centered-layout";
import { CheckEmailClient } from "./check-email-client";

type SearchParams = { email?: string };

export default async function CheckEmailPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const email = (sp.email ?? "").trim();

  return (
    <AuthCenteredLayout
      title="Check your email"
      subtitle={
        email ? (
          <>
            We sent a confirmation email to <span className="font-medium text-[#09090B]">{email}</span>. Please verify your
            account before logging in.
          </>
        ) : (
          <>We sent a confirmation email to your address. Please verify your account before logging in.</>
        )
      }
    >
      <CheckEmailClient email={email.length ? email : null} />
    </AuthCenteredLayout>
  );
}

