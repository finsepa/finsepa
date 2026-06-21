import "server-only";

import { pickProcessEnv } from "@/lib/env/pick-process-env";

/** Secret path segment — page lives at `/ops/{slug}`. Wrong slug → 404. */
export function getAdminHealthSlug(): string | undefined {
  const v = pickProcessEnv("ADMIN" + "_" + "HEALTH" + "_" + "SLUG");
  return v?.trim() || undefined;
}

/** Shared password for the ops dashboard (checked with timing-safe compare). */
export function getAdminHealthPassword(): string | undefined {
  const v = pickProcessEnv("ADMIN" + "_" + "HEALTH" + "_" + "PASSWORD");
  return v?.trim() || undefined;
}

export function isAdminHealthConfigured(): boolean {
  return Boolean(getAdminHealthSlug() && getAdminHealthPassword());
}
