import { NextResponse } from "next/server";

import { adminHealthSlugMatches, hasValidAdminHealthSession } from "@/lib/admin-health/auth";
import { isAdminHealthConfigured } from "@/lib/admin-health/env";
import { runAdminHealthChecks } from "@/lib/admin-health/run-checks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  if (!isAdminHealthConfigured()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { slug } = await params;
  if (!adminHealthSlugMatches(slug)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (!(await hasValidAdminHealthSession(slug))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const report = await runAdminHealthChecks();
  return NextResponse.json(report);
}
