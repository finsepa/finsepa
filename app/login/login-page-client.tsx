"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthCenteredLayout } from "@/components/auth/auth-centered-layout";
import { LoginClient } from "./login-client";

type Props = {
  resetSuccess: boolean;
  callbackError: string | null;
};

export function LoginPageClient({ resetSuccess, callbackError }: Props) {
  const [passwordLoginSuccess, setPasswordLoginSuccess] = useState(false);

  return (
    <AuthCenteredLayout
      preCard={
        passwordLoginSuccess ? (
          <div
            role="status"
            className="rounded-[10px] border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-2.5 text-center text-sm font-medium leading-5 text-[#166534] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          >
            Logged in successfully. Redirecting to the app…
          </div>
        ) : null
      }
      title="Log in to your account"
      subtitle={
        <>
          <span className="text-[#71717A]">Not a member yet? </span>
          <Link
            href="/signup"
            className="font-bold text-[#2563EB] transition-colors hover:text-[#1D4ED8]"
          >
            Get a free trial
          </Link>
        </>
      }
    >
      <LoginClient
        resetSuccess={resetSuccess}
        callbackError={callbackError}
        onEmailPasswordSuccess={() => setPasswordLoginSuccess(true)}
      />
    </AuthCenteredLayout>
  );
}
