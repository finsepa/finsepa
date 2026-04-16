import "server-only";

import { pickProcessEnv } from "@/lib/env/pick-process-env";

/** Loops REST API key for transactional email (`/api/v1/transactional`). */
export function getLoopsApiKey(): string | undefined {
  const primary = pickProcessEnv("LOOPS" + "_" + "API" + "_" + "KEY");
  if (primary) return primary;
  return pickProcessEnv("LOOP" + "_" + "API" + "_" + "KEY");
}
