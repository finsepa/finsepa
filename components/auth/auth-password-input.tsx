"use client";

import { Eye, EyeOff } from "@/lib/icons";
import { useState, type InputHTMLAttributes } from "react";

import { authInputClassName } from "@/components/auth/auth-form-ui";
import { cn } from "@/lib/utils";

export function AuthPasswordInput({
  className,
  value,
  onChange,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  const isControlled = value !== undefined || onChange !== undefined;

  return (
    <div className="relative">
      <input
        {...props}
        onChange={onChange}
        {...(isControlled ? { value: value ?? "" } : {})}
        type={visible ? "text" : "password"}
        className={cn(authInputClassName, "pr-[34px]", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        disabled={props.disabled}
        className="pointer-events-auto absolute inset-y-0 right-0 flex items-center pr-4 text-[#09090B] transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/30 disabled:cursor-not-allowed disabled:opacity-60"
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
