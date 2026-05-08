import { LoginPageClient } from "./login-page-client";

type SearchParams = { reset?: string; error?: string };

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F7F7" },
    { media: "(prefers-color-scheme: dark)", color: "#F7F7F7" },
  ],
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  return (
    <LoginPageClient resetSuccess={sp.reset === "success"} callbackError={sp.error ?? null} />
  );
}
