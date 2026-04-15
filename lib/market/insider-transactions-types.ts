export type InsiderTransactionKind = "purchase" | "sale" | "planned_sale" | "other";

export type InsiderTransactionRow = {
  transactionDate: string;
  ownerName: string;
  ownerTitle: string | null;
  transactionCode: string;
  kind: InsiderTransactionKind;
  shares: number | null;
  positionChangePct: number | null;
  price: number | null;
  value: number | null;
};
