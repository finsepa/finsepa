import Link from "next/link";
import { SignupClient } from "./signup-client";
import { AuthCenteredLayout } from "@/components/auth/auth-centered-layout";

export default function SignupPage() {
  return (
    <AuthCenteredLayout
      title="Sign up to your account"
      subtitle={
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold underline decoration-[#E4E4E7] underline-offset-4 transition-colors hover:decoration-[#A1A1AA]"
          >
            Log in
          </Link>
        </>
      }
    >
      <SignupClient />
    </AuthCenteredLayout>
  );
}
