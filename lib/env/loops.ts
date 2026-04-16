import "server-only";

import { pickProcessEnvB64 } from "@/lib/env/pick-process-env";

/** Loops REST API key for transactional email (`/api/v1/transactional`). */
export function getLoopsApiKey(): string | undefined {
  const primary = pickProcessEnvB64("TE9PUFNfQVBJX0tFWQ==");
  if (primary) return primary;
  return pickProcessEnvB64("TE9PUF9BUElfS0VZ");
}
