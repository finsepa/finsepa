import Link from "next/link";
import { ForgotPasswordClient } from "./forgot-password-client";
import { AuthCenteredLayout } from "@/components/auth/auth-centered-layout";
import { PATH_LOGIN } from "@/lib/auth/routes";

export default function ForgotPasswordPage() {
  return (
    <AuthCenteredLayout
      title="Reset your password"
      subtitle={
        <>
          Remember your password?{" "}
          <Link
            href={PATH_LOGIN}
            className="font-semibold underline decoration-[#E4E4E7] underline-offset-4 transition-colors hover:decoration-[#A1A1AA]"
          >
            Log in
          </Link>
        </>
      }
    >
      <ForgotPasswordClient />
    </AuthCenteredLayout>
  );
}
