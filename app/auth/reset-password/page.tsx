import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { AuthVisualPanel } from "@/components/auth/auth-visual-panel";
import { ResetPasswordClient } from "./reset-password-client";

export default function ResetPasswordPage() {
  return <AuthSplitLayout left={<AuthVisualPanel />} right={<ResetPasswordClient />} />;
}
