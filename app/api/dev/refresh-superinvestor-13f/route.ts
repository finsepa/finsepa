import { NextResponse } from "next/server";

import { pickProcessEnv } from "@/lib/env/pick-process-env";
import { forceRefreshSuperinvestorProfilePage } from "@/lib/superinvestors/load-superinvestor-profile-data";
import { refreshSuperinvestorListSnapshot } from "@/lib/superinvestors/superinvestor-list-snapshot";

export const runtime = "nodejs";

function authorize(request: Request): boolean {
  const secret = pickProcessEnv("CRON_SECRET");
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/** Authenticated ops (non-prod): bust in-memory caches and reload one profile from SEC. */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not_available" }, { status: 404 });
  }
  if (!authorize(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let slug = "berkshire-hathaway";
  try {
    const body = (await request.json()) as { slug?: string };
    if (body.slug?.trim()) slug = body.slug.trim();
  } catch {
    /* default slug */
  }

  try {
    const page = await forceRefreshSuperinvestorProfilePage(slug);
    if (!page) return NextResponse.json({ error: "unknown_slug" }, { status: 404 });
    const list = await refreshSuperinvestorListSnapshot();

    return NextResponse.json({
      slug,
      filingDate: page.comparison.current.filingDate,
      reportDate: page.comparison.current.reportDate,
      accession: page.comparison.current.accessionNumber,
      source: page.comparison.source,
      totalValueUsd: page.comparison.totalValueUsd,
      positionCount: page.comparison.positionCount,
      listSnapshotOk: list.ok,
      listRowCount: list.rowCount,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "refresh_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug")?.trim() || "berkshire-hathaway";
  return POST(
    new Request(request.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: request.headers.get("authorization") ?? "",
      },
      body: JSON.stringify({ slug }),
    }),
  );
}
