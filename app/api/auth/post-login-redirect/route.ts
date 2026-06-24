import { NextResponse } from "next/server";

import { resolvePostLoginPath } from "@/lib/auth/post-login-redirect";
import { PATH_LOGIN } from "@/lib/auth/routes";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ redirectTo: PATH_LOGIN });
  }

  const next = new URL(request.url).searchParams.get("next");
  const redirectTo = await resolvePostLoginPath(supabase, next);
  return NextResponse.json({ redirectTo });
}
