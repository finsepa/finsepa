"use client";

/**
 * First-run welcome / product tour / Pro upsell is intentionally disabled.
 * Sign-up lands on screener (or another protected route) with no onboarding modals.
 * Component kept as a no-op export so any residual imports fail closed.
 */
export function ScreenerOnboardingHost(_props: {
  userId: string;
  serverShouldShow?: boolean;
  isPro?: boolean;
}) {
  return null;
}
