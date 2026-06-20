import { PATH_AUTH_CALLBACK, PATH_AUTH_RESET_PASSWORD } from "@/lib/auth/routes";

export type AuthVerifyType =
  | "signup"
  | "recovery"
  | "invite"
  | "magiclink"
  | "email_change"
  | "email";

type GenerateLinkProperties = {
  action_link?: string;
  hashed_token?: string;
  redirect_to?: string;
  verification_type?: string;
};

function normalizeOrigin(appOrigin: string): string {
  return appOrigin.replace(/\/$/, "");
}

/**
 * Link that lands on the app (not *.supabase.co) with `token_hash` + `type` for client `verifyOtp`.
 * Avoids Supabase redirect allow-list rejecting HTTPS `redirect_to` and falling back to Site URL only.
 */
export function buildBrandedAuthLink(args: {
  appOrigin: string;
  path: string;
  properties: GenerateLinkProperties | null | undefined;
  type?: AuthVerifyType;
}): string | null {
  const token = args.properties?.hashed_token?.trim();
  const typeRaw = args.type ?? args.properties?.verification_type;
  if (!token || !typeRaw) return args.properties?.action_link ?? null;

  const type = typeRaw as AuthVerifyType;
  const origin = normalizeOrigin(args.appOrigin);
  const path = args.path.startsWith("/") ? args.path : `/${args.path}`;
  const url = new URL(`${origin}${path}`);
  url.searchParams.set("token_hash", token);
  url.searchParams.set("type", type);
  return url.toString();
}

export function buildBrandedRecoveryLink(
  appOrigin: string,
  properties: GenerateLinkProperties | null | undefined,
): string | null {
  return buildBrandedAuthLink({
    appOrigin,
    path: PATH_AUTH_RESET_PASSWORD,
    properties,
    type: "recovery",
  });
}

export function buildBrandedSignupConfirmLink(
  appOrigin: string,
  properties: GenerateLinkProperties | null | undefined,
): string | null {
  return buildBrandedAuthLink({
    appOrigin,
    path: PATH_AUTH_CALLBACK,
    properties,
    type: "signup",
  });
}
