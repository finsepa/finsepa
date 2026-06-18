import "server-only";

const LOOPS_CONTACTS_UPDATE_URL = "https://app.loops.so/api/v1/contacts/update";
const LOOPS_CONTACTS_SUPPRESSION_URL = "https://app.loops.so/api/v1/contacts/suppression";

function messageFromLoopsBody(json: unknown): string | undefined {
  if (!json || typeof json !== "object") return undefined;
  const o = json as Record<string, unknown>;
  if (typeof o.message === "string" && o.message.trim()) return o.message.trim();
  return undefined;
}

/**
 * Hard bounces suppress all Loops sends (including transactional). Clear suppression
 * for the support inbox before sending help feedback so delivery is not blocked.
 */
export async function removeLoopsContactSuppression(params: {
  apiKey: string;
  email: string;
}): Promise<{ ok: true; removed: boolean } | { ok: false; message: string }> {
  const url = `${LOOPS_CONTACTS_SUPPRESSION_URL}?email=${encodeURIComponent(params.email)}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${params.apiKey}` },
  });

  const text = await res.text();
  let json: unknown = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = {};
  }
  const parsed = json as { success?: boolean };
  const detail = messageFromLoopsBody(json);

  if (res.ok && parsed.success === true) {
    return { ok: true, removed: true };
  }

  if (detail === "This contact is not suppressed.") {
    return { ok: true, removed: false };
  }

  if (res.status === 404 || detail === "This contact was not found.") {
    return { ok: true, removed: false };
  }

  return {
    ok: false,
    message: detail || `Loops suppression removal failed (${res.status}).`,
  };
}

/** Keep the support inbox subscribed so Loops contact state stays clean. */
export async function ensureLoopsContactSubscribed(params: {
  apiKey: string;
  email: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await fetch(LOOPS_CONTACTS_UPDATE_URL, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: params.email, subscribed: true }),
  });

  const text = await res.text();
  let json: unknown = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = {};
  }
  const parsed = json as { success?: boolean };
  const detail = messageFromLoopsBody(json);

  if (res.ok && parsed.success === true) {
    return { ok: true };
  }

  return {
    ok: false,
    message: detail || `Loops contact update failed (${res.status}).`,
  };
}

/**
 * Prepare a recipient address for transactional delivery (clear bounce suppression,
 * resubscribe). Failures are logged but non-fatal unless suppression cannot be cleared.
 */
export async function prepareLoopsTransactionalRecipient(params: {
  apiKey: string;
  email: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const suppression = await removeLoopsContactSuppression(params);
  if (!suppression.ok) return suppression;

  const subscribed = await ensureLoopsContactSubscribed(params);
  if (!subscribed.ok) {
    // Non-fatal: unsubscribed contacts still receive transactional mail.
    console.warn("[loops/contacts] could not resubscribe", params.email, subscribed.message);
  }

  return { ok: true };
}
