import { NextResponse } from "next/server";

import {
  adminHealthSlugMatches,
  setAdminHealthSessionCookie,
  verifyAdminHealthPassword,
} from "@/lib/admin-health/auth";
import { isAdminHealthConfigured } from "@/lib/admin-health/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

export async function POST(request: Request, { params }: Ctx) {
  if (!isAdminHealthConfigured()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { slug } = await params;
  if (!adminHealthSlugMatches(slug)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let body: { password?: string };
  try {
    body = (await request.json()) as { password?: string };
  } catch {
    return NextResponse.json({ message: "Invalid request." }, { status: 400 });
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (!verifyAdminHealthPassword(password)) {
    return NextResponse.json({ message: "Incorrect password." }, { status: 401 });
  }

  const session = setAdminHealthSessionCookie(slug);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(session.name, session.value, session.options);
  return response;
}
