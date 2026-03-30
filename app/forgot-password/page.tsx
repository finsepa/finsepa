import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { AuthVisualPanel } from "@/components/auth/auth-visual-panel";
import { ForgotPasswordClient } from "./forgot-password-client";

export default function ForgotPasswordPage() {
  return <AuthSplitLayout left={<AuthVisualPanel />} right={<ForgotPasswordClient />} />;
}
