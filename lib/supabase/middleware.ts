import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import {
  supabaseAuthCookieOptions,
  withDurableAuthCookieOptions,
} from "@/lib/supabase/auth-cookie-options";

export function createSupabaseMiddlewareClient(request: NextRequest): {
  supabase: SupabaseClient | null;
  response: NextResponse;
} {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return { supabase: null, response: supabaseResponse };
  }

  const supabase = createServerClient(url, key, {
    cookieOptions: supabaseAuthCookieOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, withDurableAuthCookieOptions(options));
        });
      },
    },
  });

  return { supabase, response: supabaseResponse };
}
