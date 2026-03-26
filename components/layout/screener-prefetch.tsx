"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Warm the /screener RSC payload after the user lands in the app shell. */
export function ScreenerRoutePrefetch() {
  const router = useRouter();
  useEffect(() => {
    router.prefetch("/screener");
  }, [router]);
  return null;
}
