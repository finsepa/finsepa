import { NextResponse } from "next/server";

import { pickProcessEnv } from "@/lib/env/pick-process-env";
import { sendEarningsApnsToDevices } from "@/lib/notifications/apns-push";
import { listDevicePushTokensForUsers } from "@/lib/notifications/device-push-tokens-store";
import { MARKET_PRICE_MOVE_KIND, priceMoveCopy } from "@/lib/notifications/market-alerts-model";
import { absolutePushLogoUrl } from "@/lib/notifications/user-notifications-store";
import { logoDevStockLogoUrl } from "@/lib/screener/company-logo-url";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function authorize(request: Request): boolean {
  const secret = pickProcessEnv("CRON_SECRET");
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/** Sends one sample Price Alert push to a user's devices (operator check for push copy + logo). */
export async function POST(request: Request) {
  if (!authorize(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const email = url.searchParams.get("email")?.trim().toLowerCase();
  const ticker = (url.searchParams.get("ticker") ?? "GLXY").trim().toUpperCase();
  if (!email) return NextResponse.json({ error: "email_required" }, { status: 400 });

  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "no_supabase_admin" }, { status: 500 });

  const { data: users, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const user = users.users.find((u) => u.email?.toLowerCase() === email);
  if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });

  const devices = await listDevicePushTokensForUsers(admin, [user.id]);
  const logoUrl = absolutePushLogoUrl(logoDevStockLogoUrl(ticker));
  const copy = priceMoveCopy({ ticker, companyName: ticker, price: 15.86, changePct: 12.4 });
  const result = await sendEarningsApnsToDevices(admin, devices, {
    ...copy,
    ticker,
    kind: MARKET_PRICE_MOVE_KIND,
    logoUrl,
  });

  return NextResponse.json({ devices: devices.length, logoUrl: logoUrl ?? null, ...result });
}
