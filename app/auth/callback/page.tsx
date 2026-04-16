import { AuthCenteredLayout } from "@/components/auth/auth-centered-layout";
import { AuthCallbackClient } from "./auth-callback-client";

export default function AuthCallbackPage() {
  return (
    <AuthCenteredLayout compact title="You're in" subtitle="Taking you to Finsepa…">
      <AuthCallbackClient />
    </AuthCenteredLayout>
  );
}
