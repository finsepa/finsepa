/**
 * Same-origin URL for allowlisted remote images (Google avatars, favicons, etc.)
 * so html-to-image export can fetch + inline without CORS failures.
 */

function blobToDataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

function sniffImageMime(bytes: ArrayBuffer): string | null {
  const u = new Uint8Array(bytes);
  if (u.length >= 3 && u[0] === 0xff && u[1] === 0xd8 && u[2] === 0xff) return "image/jpeg";
  if (
    u.length >= 8 &&
    u[0] === 0x89 &&
    u[1] === 0x50 &&
    u[2] === 0x4e &&
    u[3] === 0x47
  ) {
    return "image/png";
  }
  if (u.length >= 6 && u[0] === 0x47 && u[1] === 0x49 && u[2] === 0x46) return "image/gif";
  if (u.length >= 12 && u[0] === 0x52 && u[1] === 0x49 && u[2] === 0x46 && u[3] === 0x46) {
    return "image/webp";
  }
  // SVG often starts with whitespace + "<svg" / "<?xml"
  const head = new TextDecoder().decode(u.slice(0, Math.min(u.length, 64))).trimStart();
  if (head.startsWith("<svg") || head.startsWith("<?xml")) return "image/svg+xml";
  return null;
}

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

/**
 * Fetch an image (preferring same-origin / proxy) and return a data URL for export.
 * Handles `/api/media/logo` → Google favicon redirects that break CORS body reads.
 */
export async function imageSrcToDataUrl(
  src: string | null | undefined,
  depth = 0,
): Promise<string | null> {
  if (depth > 3) return null;
  const proxied = sameOriginRemoteImageUrl(src);
  if (!proxied) return null;
  if (proxied.startsWith("data:")) return proxied;

  try {
    const res = await fetch(proxied, {
      credentials: "same-origin",
      cache: "force-cache",
      redirect: "manual",
    });

    if (res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)) {
      const loc = res.headers.get("Location");
      if (!loc) return null;
      const abs = new URL(loc, typeof window !== "undefined" ? window.location.href : "http://localhost").href;
      return imageSrcToDataUrl(abs, depth + 1);
    }

    if (!res.ok) return null;
    const blob = await res.blob();
    let type = (blob.type || "").split(";")[0]!.trim();
    if (!type.startsWith("image/")) {
      const sniffed = sniffImageMime(await blob.slice(0, 64).arrayBuffer());
      if (!sniffed) return null;
      type = sniffed;
      const typed = new Blob([blob], { type });
      return blobToDataUrl(typed);
    }
    return blobToDataUrl(blob);
  } catch {
    return null;
  }
}
