import { AuthCenteredLayout } from "@/components/auth/auth-centered-layout";

import { AuthCallbackCompleteClient } from "./auth-callback-complete-client";

export const dynamic = "force-dynamic";

export default function AuthCallbackCompletePage() {
  return (
    <AuthCenteredLayout split={false} compact title="You're in" subtitle="Taking you to Finsepa…">
      <AuthCallbackCompleteClient />
    </AuthCenteredLayout>
  );
}
