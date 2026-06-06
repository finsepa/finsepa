import { Loader2 } from "@/lib/icons";

import { cn } from "@/lib/utils";

function Spinner({ className, ...props }: React.ComponentProps<typeof Loader2>) {
  return (
    <Loader2
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      strokeWidth={2}
      {...props}
    />
  );
}

export { Spinner };
