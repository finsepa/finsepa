"use client";

import { useEffect, useState } from "react";

/** Avoid portal hydration mismatch — server and first client paint both render null. */
export function useClientMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
