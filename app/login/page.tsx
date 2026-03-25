import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { AuthVisualPanel } from "@/components/auth/auth-visual-panel";
import { LoginClient } from "./login-client";

export default function LoginPage() {
  return <AuthSplitLayout left={<AuthVisualPanel />} right={<LoginClient />} />;
}
