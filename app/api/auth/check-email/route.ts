import { NextResponse } from "next/server";

import { allowCheckEmailRequest } from "@/lib/auth/check-email-rate-limit";
import { lookupLoginEmail } from "@/lib/auth/lookup-login-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Body = {
  email?: unknown;
};

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  if (!allowCheckEmailRequest(clientIp(request), email)) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many checks. Wait a moment and try again." },
      { status: 429 },
    );
  }

  const result = await lookupLoginEmail(email);
  if (!result.ok) {
    return NextResponse.json(
      { error: "unavailable", message: "Could not verify this email right now." },
      { status: 503 },
    );
  }

  if (!result.exists) {
    return NextResponse.json({ exists: false as const });
  }

  return NextResponse.json({
    exists: true as const,
    googleOnly: result.googleOnly,
  });
}
