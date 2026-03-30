import { redirect } from "next/navigation";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { PATH_APP_ENTRY, PATH_LOGIN } from "@/lib/auth/routes";

export default async function HomePage() {
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    redirect(user ? PATH_APP_ENTRY : PATH_LOGIN);
  } catch {
    // If Supabase isn’t configured (e.g., during certain build/test runs), fall back to login.
    redirect(PATH_LOGIN);
  }
}
