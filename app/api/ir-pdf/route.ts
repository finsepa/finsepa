import { isIrPdfProxyUrlAllowed } from "@/lib/market/ir-pdf-proxy-allowlist";

export const dynamic = "force-dynamic";

/**
 * Stream a whitelisted PDF through our origin for in-app preview (`<iframe src="/api/ir-pdf?...">`).
 */
export async function GET(request: Request) {
  const u = new URL(request.url).searchParams.get("u");
  if (!u?.trim()) {
    return new Response("Missing u", { status: 400 });
  }
  if (!isIrPdfProxyUrlAllowed(u)) {
    return new Response("URL not allowed", { status: 403 });
  }

  let res: Response;
  try {
    res = await fetch(u, {
      method: "GET",
      headers: { Accept: "application/pdf,*/*" },
      cache: "no-store",
    });
  } catch {
    return new Response("Upstream fetch failed", { status: 502 });
  }
  if (!res.ok) {
    return new Response("Upstream not OK", { status: 502, statusText: res.statusText });
  }

  const type = res.headers.get("content-type");
  const ct = type?.toLowerCase() ?? "";
  if (ct && (ct.includes("text/html") || ct.startsWith("text/html"))) {
    return new Response("Not a PDF", { status: 502 });
  }

  const outHeaders = new Headers();
  outHeaders.set("Content-Type", "application/pdf");
  outHeaders.set("Content-Disposition", "inline");
  outHeaders.set("Cache-Control", "private, max-age=300");
  if (res.body) {
    return new Response(res.body, { status: 200, headers: outHeaders });
  }
  return new Response("Empty body", { status: 502 });
}
