export function normalizeHeaderText(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[_/]+/g, " ");
}
