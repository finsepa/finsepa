import "server-only";

const LOOPS_TRANSACTIONAL_URL = "https://app.loops.so/api/v1/transactional";

function messageFromLoopsBody(json: unknown): string | undefined {
  if (!json || typeof json !== "object") return undefined;
  const o = json as Record<string, unknown>;
  if (typeof o.message === "string" && o.message.trim()) return o.message.trim();
  const nested = o.error;
  if (nested && typeof nested === "object") {
    const e = nested as Record<string, unknown>;
    if (typeof e.message === "string" && e.message.trim()) return e.message.trim();
    if (typeof e.reason === "string" && e.reason.trim()) return e.reason.trim();
  }
  return undefined;
}

export async function sendLoopsSignupConfirmationEmail(params: {
  apiKey: string;
  transactionalId: string;
  to: string;
  confirmationLink: string;
  firstName: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await fetch(LOOPS_TRANSACTIONAL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      transactionalId: params.transactionalId,
      email: params.to,
      addContact: true,
      dataVariables: {
        firstName: params.firstName,
        confirmationLink: params.confirmationLink,
      },
    }),
  });

  const text = await res.text();
  let json: unknown = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = {};
  }
  const parsed = json as { success?: boolean };
  const detail = messageFromLoopsBody(json) || (text && !text.startsWith("{") ? text.slice(0, 200) : undefined);

  if (!res.ok || parsed.success === false) {
    return {
      ok: false,
      message:
        detail ||
        `Loops request failed (${res.status}). Check LOOPS_API_KEY, LOOPS_TRANSACTIONAL_ID_SIGNUP, and template variables firstName + confirmationLink.`,
    };
  }
  return { ok: true };
}
