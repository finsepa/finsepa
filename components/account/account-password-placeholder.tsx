"use client";

import { useState } from "react";
import { Eye, EyeOff } from "@/lib/icons";
import { textInputFieldClassName } from "@/components/design-system/text-input-styles";
import { cn } from "@/lib/utils";

const MASKED_PASSWORD = "********";

export function AccountPasswordPlaceholder({
  id,
  className,
}: {
  id: string;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={cn("relative sm:min-w-0 sm:flex-1", className)}>
      <input
        id={id}
        type="text"
        value={MASKED_PASSWORD}
        readOnly
        aria-readonly="true"
        autoComplete="off"
        data-1p-ignore
        data-lpignore="true"
        data-form-type="other"
        className={cn(
          "w-full cursor-not-allowed rounded-[10px] px-3 pr-10 text-sm text-fg-muted opacity-60",
          textInputFieldClassName,
          "hover:outline-field-stroke focus:shadow-none focus:ring-0 dark:hover:outline-field-stroke dark:focus:ring-0",
        )}
        style={{ WebkitTextSecurity: visible ? "none" : "disc" } as React.CSSProperties}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        className="absolute inset-y-0 right-0 flex cursor-pointer items-center pr-3 text-icon transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/15"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
      >
        {visible ? (
          <EyeOff className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
        ) : (
          <Eye className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
        )}
      </button>
    </div>
  );
}
