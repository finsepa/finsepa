import { AuthCenteredLayout } from "@/components/auth/auth-centered-layout";

import { AuthCallbackClient } from "./auth-callback-client";

export const dynamic = "force-dynamic";

export default function AuthCallbackPage() {
  return (
    <AuthCenteredLayout split={false} compact title="Almost there" subtitle="Finishing your sign-in…">
      <AuthCallbackClient />
    </AuthCenteredLayout>
  );
}
