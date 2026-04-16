import { AuthCenteredLayout } from "@/components/auth/auth-centered-layout";
import { AuthCallbackClient } from "./auth-callback-client";

export default function AuthCallbackPage() {
  return (
    <AuthCenteredLayout title="Finishing sign-in" subtitle="Please wait while we confirm your link.">
      <AuthCallbackClient />
    </AuthCenteredLayout>
  );
}
