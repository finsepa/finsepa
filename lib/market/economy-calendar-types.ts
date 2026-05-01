/** Serialized economic calendar row for the Economy week grid (client-safe). */

export type EconomyEventImportance = 1 | 2 | 3;

export type EconomyCalendarEvent = {
  id: string;
  type: string;
  comparison: string | null;
  period: string | null;
  country: string;
  /** Provider datetime string (typically `YYYY-MM-DD HH:MM:SS`, interpreted as UTC for sorting/placement). */
  dateRaw: string;
  instantMs: number;
  actual: number | null;
  previous: number | null;
  estimate: number | null;
  importance: EconomyEventImportance;
};

export type EconomyDayColumn = {
  date: string;
  weekdayLabel: string;
  dayNumber: string;
  events: EconomyCalendarEvent[];
};

export type EconomyWeekPayload = {
  weekMondayYmd: string;
  weekLabel: string;
  days: EconomyDayColumn[];
};
