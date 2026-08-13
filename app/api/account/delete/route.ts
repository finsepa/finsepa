import { NextResponse } from "next/server";

import {
  deleteFinsepaAccount,
  isDeleteAccountConfirmPhrase,
} from "@/lib/account/delete-account";
import { resolveAuthUserFromRequest } from "@/lib/auth/resolve-auth-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  confirm?: unknown;
};

export async function POST(request: Request) {
  const user = await resolveAuthUserFromRequest(request);

  if (!user?.id) {
    return NextResponse.json({ error: "not_authenticated", message: "Not signed in." }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Invalid request." }, { status: 400 });
  }

  if (!isDeleteAccountConfirmPhrase(body.confirm)) {
    return NextResponse.json(
      {
        error: "confirm_required",
        message: "Type DELETE to confirm account deletion.",
      },
      { status: 400 },
    );
  }

  const result = await deleteFinsepaAccount({
    userId: user.id,
    email: user.email ?? null,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: "delete_failed", message: result.message },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true as const });
}
