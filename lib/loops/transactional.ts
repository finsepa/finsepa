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

/**
 * Generic Loops transactional send (`transactionalId` + `email`; optional `dataVariables`).
 * @see https://loops.so/docs/api-reference/send-transactional-email
 */
export async function sendLoopsTransactionalEmail(params: {
  apiKey: string;
  transactionalId: string;
  to: string;
  addContact?: boolean;
  dataVariables?: Record<string, string | number | boolean>;
  /** Appended to error messages for debugging (which template / env id). */
  errorHint?: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const body: Record<string, unknown> = {
    transactionalId: params.transactionalId,
    email: params.to,
    addContact: params.addContact !== false,
  };
  if (params.dataVariables && Object.keys(params.dataVariables).length > 0) {
    body.dataVariables = params.dataVariables;
  }

  const res = await fetch(LOOPS_TRANSACTIONAL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
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
    const hint = params.errorHint?.trim();
    return {
      ok: false,
      message:
        detail ||
        `Loops request failed (${res.status}).${hint ? ` ${hint}` : " Check LOOPS_API_KEY and transactional template."}`,
    };
  }

  // Loops documents `{ "success": true }` on acceptance — require it so we don't treat ambiguous bodies as sent.
  if (parsed.success !== true) {
    const snippet = text.trim().slice(0, 280) || "(empty body)";
    return {
      ok: false,
      message: `Loops HTTP ${res.status} but JSON success was not true: ${snippet}. See https://loops.so/docs/api-reference/send-transactional-email`,
    };
  }

  return { ok: true };
}

/**
 * Loops transactional email with `firstName` + `confirmationLink` data variables (sign-up, password reset, etc.).
 */
export async function sendLoopsTransactionalAuthEmail(params: {
  apiKey: string;
  transactionalId: string;
  to: string;
  confirmationLink: string;
  firstName: string;
  /** Appended to error messages for debugging (which template / env id). */
  errorHint?: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  return sendLoopsTransactionalEmail({
    apiKey: params.apiKey,
    transactionalId: params.transactionalId,
    to: params.to,
    dataVariables: {
      firstName: params.firstName,
      confirmationLink: params.confirmationLink,
    },
    errorHint:
      params.errorHint ?? "Check LOOPS_API_KEY and template variables firstName + confirmationLink.",
  });
}
