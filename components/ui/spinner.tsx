import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

/** Spinner + label row for buttons and compact inline loading states. */
function SpinnerLabel({
  children,
  className,
  spinnerClassName,
}: {
  children: ReactNode;
  className?: string;
  spinnerClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center justify-center gap-2", className)}>
      <Spinner data-icon="inline-start" className={cn("size-4 shrink-0", spinnerClassName)} />
      {children}
    </span>
  );
}

export { Spinner, SpinnerLabel };
