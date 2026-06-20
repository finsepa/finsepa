/**
 * Mirrors GoTrue `parseParametersFromURL`: merge fragment then query (query wins on duplicate keys).
 */
export function parseAuthCallbackParams(href: string): Record<string, string> {
  const result: Record<string, string> = {};
  const url = new URL(href);
  if (url.hash?.startsWith("#")) {
    try {
      new URLSearchParams(url.hash.slice(1)).forEach((value, key) => {
        result[key] = value;
      });
    } catch {
      /* ignore */
    }
  }
  url.searchParams.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

/** True when the URL carries tokens Supabase appends after email verify or OAuth. */
export function urlHasAuthCallbackParams(href: string): boolean {
  const params = parseAuthCallbackParams(href);
  if (params.code || params.token_hash) return true;
  if (params.access_token && params.refresh_token) return true;
  try {
    const hash = new URL(href).hash;
    return hash.length > 1 && /access_token|code|token_hash/.test(hash);
  } catch {
    return false;
  }
}
