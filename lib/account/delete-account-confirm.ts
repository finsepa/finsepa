/** Phrase the user must type to confirm permanent account deletion. */
export const DELETE_ACCOUNT_CONFIRM_PHRASE = "DELETE";

export function isDeleteAccountConfirmPhrase(value: unknown): boolean {
  return typeof value === "string" && value.trim() === DELETE_ACCOUNT_CONFIRM_PHRASE;
}
