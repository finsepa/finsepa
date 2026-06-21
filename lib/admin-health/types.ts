export type HealthStatus = "ok" | "warn" | "error";

export type HealthCheck = {
  id: string;
  label: string;
  status: HealthStatus;
  summary: string;
  details?: Record<string, string | number | boolean | null>;
  latencyMs?: number;
  error?: string;
};

export type HealthReport = {
  checkedAt: string;
  vercelEnv: string | null;
  checks: HealthCheck[];
};
