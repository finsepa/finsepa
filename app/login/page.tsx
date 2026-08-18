import Link from "next/link";

import { AuthCenteredLayout } from "@/components/auth/auth-centered-layout";
import { AuthLegalFooterLinks } from "@/components/auth/auth-continue-legal-notice";
import {
  authAccentLinkClassName,
  authAlertBannerClassName,
  authSuccessBannerClassName,
} from "@/components/auth/auth-form-ui";
import { Check } from "@/lib/icons";
import { cn } from "@/lib/utils";

import { isEmailOtpEnabledServer } from "@/lib/auth/email-otp-enabled";
import { LOGIN_ACCOUNT_DELETED_VALUE, LOGIN_SIGNED_OUT_VALUE } from "@/lib/auth/routes";

import { LoginClient } from "./login-client";

type SearchParams = {
  reset?: string;
  error?: string;
  next?: string;
  signed_out?: string;
  account_deleted?: string;
};

function callbackErrorMessages(otpEnabled: boolean): Record<string, string> {
  const emailHint = otpEnabled ? "email code" : "email and password";
  return {
    session: `Google sign-in could not finish (session expired or was already used). Close other Finsepa tabs, try again from https://app.finsepa.com/login, or use ${emailHint}.`,
    missing_code: "That sign-in link is incomplete. Open the link from your email again.",
    oauth: `Google sign-in was cancelled or blocked. Try again, or use ${emailHint} if the problem continues.`,
    config: "Authentication isn’t configured correctly. Please try again later.",
  };
}

export { authMetadata as metadata, authViewport as viewport } from "@/lib/auth/auth-viewport";

export default async function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const otpEnabled = isEmailOtpEnabledServer();
  const signedOut = sp.signed_out === LOGIN_SIGNED_OUT_VALUE;
  const accountDeleted = sp.account_deleted === LOGIN_ACCOUNT_DELETED_VALUE;
  const messages = callbackErrorMessages(otpEnabled);
  const callbackHint = sp.error
    ? (messages[sp.error] ?? "Something went wrong. Please try again.")
    : null;
  const sessionExpiredHint =
    !callbackHint && !signedOut && !accountDeleted && sp.next
      ? "Please sign in to continue."
      : null;
  const bannerHint = callbackHint ?? sessionExpiredHint;

  return (
    <AuthCenteredLayout
      split={false}
      cornerActions
      title={otpEnabled ? "Welcome to Finsepa" : "Log in to your account"}
      subtitle={
        otpEnabled ? null : (
          <>
            <span className="text-fg-muted">Not a member yet? </span>
            <Link href="/signup" className={authAccentLinkClassName}>
              Sign up
            </Link>
          </>
        )
      }
      preCard={
        accountDeleted ? (
          <div
            role="status"
            className={cn(authSuccessBannerClassName, "flex items-center gap-2")}
          >
            <Check className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
            Your account was deleted.
          </div>
        ) : signedOut ? (
          <div
            role="status"
            className={cn(authSuccessBannerClassName, "flex items-center gap-2")}
          >
            <Check className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
            You&apos;ve been logged out.
          </div>
        ) : bannerHint ? (
          <div role="alert" className={authAlertBannerClassName}>
            {bannerHint}
          </div>
        ) : null
      }
      belowCard={
        otpEnabled ? null : (
          <div className="mt-3 text-center text-[12px] leading-4">
            <Link
              href="/forgot-password"
              className="text-fg-muted transition-colors hover:text-fg"
            >
              Forgot password?
            </Link>
          </div>
        )
      }
      footer={<AuthLegalFooterLinks />}
    >
      <LoginClient
        resetSuccess={sp.reset === "success"}
        authNext={sp.next ?? null}
      />
    </AuthCenteredLayout>
  );
}
