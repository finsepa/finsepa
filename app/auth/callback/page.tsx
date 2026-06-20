import { AuthCenteredLayout } from "@/components/auth/auth-centered-layout";

import { AuthCallbackClient } from "./auth-callback-client";

export const dynamic = "force-dynamic";

export default function AuthCallbackPage() {
  return (
    <AuthCenteredLayout split={false} compact title="You're in" subtitle="Taking you to Finsepa…">
      <AuthCallbackClient />
    </AuthCenteredLayout>
  );
}
