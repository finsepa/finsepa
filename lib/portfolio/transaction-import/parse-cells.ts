import { format, isValid, parseISO } from "date-fns";

export function parseNumberLoose(raw: string): number | null {
  const t = raw.replace(/\s/g, "").replace(/[$€£]/g, "").replace(/,/g, "");
  if (!t) return null;
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

/** Returns yyyy-MM-dd or null */
export function parseDateLoose(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const ymdWithTail = /^(\d{4}-\d{2}-\d{2})(?:[ T].*)?$/.exec(s);
  if (ymdWithTail) {
    const ymd = ymdWithTail[1]!;
    const d = parseISO(ymd);
    if (isValid(d)) return ymd;
  }
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  if (iso) {
    const d = parseISO(iso);
    return isValid(d) ? iso : null;
  }
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (us) {
    const m = Number(us[1]);
    const day = Number(us[2]);
    const y = Number(us[3]);
    if (m >= 1 && m <= 12 && day >= 1 && day <= 31) {
      try {
        return format(new Date(y, m - 1, day), "yyyy-MM-dd");
      } catch {
        return null;
      }
    }
  }
  const d = parseISO(s);
  if (isValid(d)) return format(d, "yyyy-MM-dd");
  const n = Number.parseFloat(s);
  if (Number.isFinite(n) && n > 30000 && n < 60000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const ms = excelEpoch.getTime() + n * 86400000;
    const dt = new Date(ms);
    if (isValid(dt)) return format(dt, "yyyy-MM-dd");
  }
  return null;
}
