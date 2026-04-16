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
