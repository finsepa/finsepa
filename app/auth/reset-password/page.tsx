import { ResetPasswordClient } from "./reset-password-client";

type ResetPasswordPageProps = {
  searchParams: Promise<{ token_hash?: string; type?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams;
  const hasRecoveryToken =
    params.type === "recovery" &&
    typeof params.token_hash === "string" &&
    params.token_hash.length > 0;

  return <ResetPasswordClient hasRecoveryToken={hasRecoveryToken} />;
}
