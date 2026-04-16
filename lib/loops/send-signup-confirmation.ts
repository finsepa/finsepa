import "server-only";

const LOOPS_TRANSACTIONAL_URL = "https://app.loops.so/api/v1/transactional";

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

  const json = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string };
  if (!res.ok || json.success === false) {
    return { ok: false, message: json.message?.trim() || `Loops request failed (${res.status})` };
  }
  return { ok: true };
}
