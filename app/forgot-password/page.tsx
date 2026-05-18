import Link from "next/link";
import { ForgotPasswordClient } from "./forgot-password-client";
import { AuthCenteredLayout } from "@/components/auth/auth-centered-layout";
import { PATH_LOGIN } from "@/lib/auth/routes";

export { authMetadata as metadata, authViewport as viewport } from "@/lib/auth/auth-viewport";

export default function ForgotPasswordPage() {
  return (
    <AuthCenteredLayout
      title="Reset your password"
      subtitle={
        <>
          Remember your password?{" "}
          <Link
            href={PATH_LOGIN}
            className="font-bold text-[#2563EB] transition-colors hover:text-[#1D4ED8]"
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
