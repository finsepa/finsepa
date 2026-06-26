import { toast } from "sonner";

/** Sonner confirmation after a new watchlist collection is created. */
export function toastWatchlistCreated(name: string): void {
  toast.success("Watchlist created", {
    description: `"${name}" is ready — star symbols to add them.`,
  });
}
