import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Hosts we will proxy for screenshot export (Google OAuth avatars, etc.). */
const ALLOWED_HOST_SUFFIXES = [
  "googleusercontent.com",
  "ggpht.com",
  "google.com",
] as const;

function isAllowedRemoteImageUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  const allowed = ALLOWED_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
  return allowed ? url : null;
}

/**
 * Same-origin proxy for allowlisted remote images (e.g. Google profile photos)
 * so screenshot export can inline them without CORS / rate-limit failures.
 * Query: `u=<absolute https url>`
 */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("u")?.trim() ?? "";
  const upstream = isAllowedRemoteImageUrl(raw);
  if (!upstream) {
    return NextResponse.json({ error: "Invalid image url." }, { status: 400 });
  }

  try {
    const res = await fetch(upstream.href, {
      headers: { Accept: "image/*" },
      // Avoid browser cookie leakage; this is a public avatar CDN fetch.
      cache: "force-cache",
    });
    if (!res.ok) {
      return NextResponse.json({ error: "Upstream image failed." }, { status: 502 });
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "Upstream was not an image." }, { status: 502 });
    }
    const bytes = await res.arrayBuffer();
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Upstream image fetch error." }, { status: 502 });
  }
}
