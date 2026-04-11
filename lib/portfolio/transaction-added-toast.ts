import { format } from "date-fns";
import { toast } from "sonner";

/** Sonner toast after a new ledger row is added from New Transaction. */
export function toastTransactionAdded(message: string, date: Date): void {
  toast.success(message, {
    description: format(date, "EEEE, MMMM d, yyyy"),
  });
}
