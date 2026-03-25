import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { AuthVisualPanel } from "@/components/auth/auth-visual-panel";
import { SignupClient } from "./signup-client";

export default function SignupPage() {
  return (
    <AuthSplitLayout
      left={
        <AuthVisualPanel
          title="Build your watchlist."
          subtitle="Create an account to personalize screens, save ideas, and follow what matters."
        />
      }
      right={<SignupClient />}
    />
  );
}
