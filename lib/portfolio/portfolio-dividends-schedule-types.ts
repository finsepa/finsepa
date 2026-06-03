export type PortfolioDividendEventStatus = "declared" | "estimated";

export type PortfolioDividendScheduleRow = {
  symbol: string;
  paymentDate: string;
  exDividendDate: string | null;
  status: PortfolioDividendEventStatus;
  totalUsd: number;
  perShareUsd: number;
  shares: number;
  frequencyLabel: string | null;
  growthPct: number | null;
  yieldPct: number | null;
};

export type PortfolioDividendScheduleMonth = {
  monthKey: string;
  label: string;
  totalUsd: number;
  rows: PortfolioDividendScheduleRow[];
};

export type PortfolioDividendsSchedulePayload = {
  months: PortfolioDividendScheduleMonth[];
};
