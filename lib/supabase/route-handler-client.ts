import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

export function supabasePublicKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    ""
  );
}

export function mergePendingCookies(target: CookieToSet[], incoming: CookieToSet[]) {
  for (const entry of incoming) {
    const index = target.findIndex((c) => c.name === entry.name);
    if (index >= 0) target[index] = entry;
    else target.push(entry);
  }
}

export async function createSupabaseRouteHandlerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = supabasePublicKey();
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or Supabase public key");
  }

  const cookieStore = await cookies();
  const pendingCookies: CookieToSet[] = [];

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        mergePendingCookies(
          pendingCookies,
          cookiesToSet.map(({ name, value, options }) => ({ name, value, options })),
        );
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          /* route handlers may not always allow cookieStore mutation */
        }
      },
    },
  });

  const applyCookies = (response: NextResponse) => {
    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });
    return response;
  };

  return {
    supabase,
    applyCookies,
    redirect(url: string | URL) {
      return applyCookies(NextResponse.redirect(url));
    },
  };
}
