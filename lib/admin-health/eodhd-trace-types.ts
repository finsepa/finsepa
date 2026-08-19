import type { EodhdTrafficProbeReport } from "@/lib/market/eodhd-traffic-probe";

export type EodhdTraceBudget = {
  usedHour: number;
  maxPerHour: number;
  usedDay: number;
  maxPerDay: number | null;
};

export type EodhdTraceBudgetResponse = {
  mode: "budget";
  at: string;
  budget: EodhdTraceBudget;
  providerTraceEnabled: boolean;
};

export type EodhdTraceProbeResponse = EodhdTrafficProbeReport & { mode: "probe" };
