/**
 * Same-origin URL for allowlisted remote images (Google avatars, etc.)
 * so html-to-image export can fetch + inline without CORS failures.
 */
export function sameOriginRemoteImageUrl(src: string | null | undefined): string | null {
  const raw = typeof src === "string" ? src.trim() : "";
  if (!raw) return null;
  if (raw.startsWith("data:") || raw.startsWith("/")) return raw;
  try {
    const url = new URL(raw);
    if (url.origin === (typeof window !== "undefined" ? window.location.origin : "")) {
      return raw;
    }
  } catch {
    return null;
  }
  return `/api/media/remote-image?u=${encodeURIComponent(raw)}`;
}

/** Fetch an image (preferring same-origin / proxy) and return a data URL for export. */
export async function imageSrcToDataUrl(src: string | null | undefined): Promise<string | null> {
  const proxied = sameOriginRemoteImageUrl(src);
  if (!proxied) return null;
  if (proxied.startsWith("data:")) return proxied;

  try {
    const res = await fetch(proxied, { credentials: "same-origin", cache: "force-cache" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return null;
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
