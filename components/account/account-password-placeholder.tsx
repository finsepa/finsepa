"use client";

import { useState } from "react";
import { Eye, EyeOff } from "@/lib/icons";
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
        className="h-10 w-full cursor-default rounded-[10px] border border-[#E4E4E7] bg-[#F4F4F5] py-2 pl-3 pr-10 text-sm text-[#71717A] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)] outline-none"
        style={{ WebkitTextSecurity: visible ? "none" : "disc" } as React.CSSProperties}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#0F0F0F] transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/30"
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
