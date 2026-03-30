import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { AuthVisualPanel } from "@/components/auth/auth-visual-panel";
import { LoginClient } from "./login-client";

type SearchParams = { reset?: string; error?: string };

export default async function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  return (
    <AuthSplitLayout
      left={<AuthVisualPanel />}
      right={<LoginClient resetSuccess={sp.reset === "success"} callbackError={sp.error ?? null} />}
    />
  );
}
