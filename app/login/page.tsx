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

import { LOGIN_ACCOUNT_DELETED_VALUE, LOGIN_SIGNED_OUT_VALUE } from "@/lib/auth/routes";

import { LoginClient } from "./login-client";

type SearchParams = {
  reset?: string;
  error?: string;
  next?: string;
  signed_out?: string;
  account_deleted?: string;
};

const CALLBACK_ERROR_MESSAGES: Record<string, string> = {
  session:
    "Google sign-in could not finish (session expired or was already used). Close other Finsepa tabs, try again from https://app.finsepa.com/login, or use email and password.",
  missing_code: "That sign-in link is incomplete. Open the link from your email again.",
  oauth:
    "Google sign-in was cancelled or blocked. Try again, or use email and password if the problem continues.",
  config: "Authentication isn’t configured correctly. Please try again later.",
};

export { authMetadata as metadata, authViewport as viewport } from "@/lib/auth/auth-viewport";

export default async function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const signedOut = sp.signed_out === LOGIN_SIGNED_OUT_VALUE;
  const accountDeleted = sp.account_deleted === LOGIN_ACCOUNT_DELETED_VALUE;
  const callbackHint = sp.error
    ? (CALLBACK_ERROR_MESSAGES[sp.error] ?? "Something went wrong. Please try again.")
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
      title="Log in to your account"
      subtitle={
        <>
          <span className="text-fg-muted">Not a member yet? </span>
          <Link href="/signup" className={authAccentLinkClassName}>
            Get a free trial
          </Link>
        </>
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
        <div className="mt-3 text-center text-[12px] leading-4">
          <Link
            href="/forgot-password"
            className="text-fg-muted transition-colors hover:text-fg"
          >
            Forgot password?
          </Link>
        </div>
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
