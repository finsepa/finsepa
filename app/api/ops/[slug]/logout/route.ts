import { NextResponse } from "next/server";

import {
  adminHealthSlugMatches,
  clearAdminHealthSessionCookie,
} from "@/lib/admin-health/auth";
import { isAdminHealthConfigured } from "@/lib/admin-health/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

export async function POST(_request: Request, { params }: Ctx) {
  if (!isAdminHealthConfigured()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { slug } = await params;
  if (!adminHealthSlugMatches(slug)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const cleared = clearAdminHealthSessionCookie(slug);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(cleared.name, cleared.value, cleared.options);
  return response;
}
