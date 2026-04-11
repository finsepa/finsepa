import { format, parseISO } from "date-fns";
import { toast } from "sonner";

import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";

/** Sonner toast after a ledger row is removed. */
export function toastTransactionDeleted(transaction: PortfolioTransaction): void {
  const { name, symbol, date } = transaction;
  const description = format(parseISO(date), "EEEE, MMMM d, yyyy");

  toast.success(`Transaction for ${name} (${symbol}) has been deleted.`, {
    description,
  });
}
