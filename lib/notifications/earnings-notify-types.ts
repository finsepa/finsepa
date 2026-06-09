export type EarningsNotifyCalendarRow = {
  eodhdCode: string;
  ticker: string;
  reportDateYmd: string | null;
  fiscalPeriodEndYmd: string | null;
  epsActual: number | null;
  epsEstimate: number | null;
  surprisePct: number | null;
};

export type EarningsReleaseSnapshotRow = {
  ticker: string;
  fiscal_period_end: string;
  report_date: string | null;
  eps_actual: number | null;
  eps_estimate: number | null;
  surprise_pct: number | null;
};

export type UserNotificationRow = {
  id: string;
  user_id: string;
  kind: string;
  ticker: string;
  title: string;
  body: string;
  href: string | null;
  payload: Record<string, unknown>;
  dedupe_key: string;
  read_at: string | null;
  created_at: string;
};

export type EarningsNotifyIngestResult = {
  skipped: boolean;
  skipReason?: string;
  universeTickers: number;
  calendarBatches: number;
  calendarRows: number;
  releasesDetected: number;
  notificationsCreated: number;
  eodhdRequests: number;
};
