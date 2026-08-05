import { redirect } from "next/navigation";
import { getSubscriptionGateContext } from "@/lib/account/subscription-gate";
import { PATH_APP_ENTRY, PATH_LOGIN } from "@/lib/auth/routes";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ActivateSubscriptionClient } from "./activate-subscription-client";

export { authMetadata as metadata, authViewport as viewport } from "@/lib/auth/auth-viewport";

/** Optional upgrade marketing; Pro/trial already have full access and skip here. */
export default async function ActivateSubscriptionPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`${PATH_LOGIN}?next=${encodeURIComponent("/activate-subscription")}`);
  }

  const gate = await getSubscriptionGateContext(supabase, user.id);
  if (gate.isPro || gate.isTrial) {
    redirect(PATH_APP_ENTRY);
  }

  return <ActivateSubscriptionClient />;
}
