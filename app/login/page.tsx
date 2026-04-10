import { LoginPageClient } from "./login-page-client";

type SearchParams = { reset?: string; error?: string };

export default async function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  return (
    <LoginPageClient resetSuccess={sp.reset === "success"} callbackError={sp.error ?? null} />
  );
}
