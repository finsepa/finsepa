import * as XLSX from "xlsx";

export type RawSheetMatrix = {
  sheetName: string;
  /** Row 0 = headers; further rows = data */
  rows: string[][];
};

function cellToString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(v).trim();
}

/**
 * Reads first worksheet as string matrix (header row + data).
 */
export function parseWorkbookToMatrix(file: ArrayBuffer): RawSheetMatrix {
  const wb = XLSX.read(file, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0] ?? "Sheet1";
  const sheet = wb.Sheets[sheetName];
  if (!sheet) {
    return { sheetName, rows: [] };
  }
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" }) as unknown[][];
  const rows = aoa.map((r) => (Array.isArray(r) ? r.map((c) => cellToString(c)) : []));
  const width = Math.max(0, ...rows.map((r) => r.length));
  const padded = rows.map((r) => {
    if (r.length >= width) return r;
    return [...r, ...Array(width - r.length).fill("")];
  });
  return { sheetName, rows: padded };
}
