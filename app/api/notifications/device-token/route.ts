import { NextResponse } from "next/server";

import {
  deleteDevicePushToken,
  upsertDevicePushToken,
} from "@/lib/notifications/device-push-tokens-store";
import { requireAuthUserFromRequest, AuthRequiredError } from "@/lib/watchlist/api-auth";
import { getSupabaseClientForRequest } from "@/lib/supabase/request-client";

function parseEnvironment(raw: unknown): "sandbox" | "production" {
  return raw === "production" ? "production" : "sandbox";
}

function parsePlatform(raw: unknown): "ios" | "android" {
  return raw === "android" ? "android" : "ios";
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthUserFromRequest(request);
    const supabase = await getSupabaseClientForRequest(request);
    const body = (await request.json()) as {
      token?: unknown;
      platform?: unknown;
      environment?: unknown;
    };
    if (typeof body.token !== "string" || body.token.trim().length < 16) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }

    await upsertDevicePushToken(supabase, {
      userId: user.id,
      token: body.token.trim().toLowerCase(),
      platform: parsePlatform(body.platform),
      environment: parseEnvironment(body.environment),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireAuthUserFromRequest(request);
    const supabase = await getSupabaseClientForRequest(request);
    const url = new URL(request.url);
    const token = url.searchParams.get("token")?.trim().toLowerCase();
    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    await deleteDevicePushToken(supabase, { userId: user.id, token });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
