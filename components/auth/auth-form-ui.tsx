import { Check } from "@/lib/icons";
import type { InputHTMLAttributes, ReactNode } from "react";

import { secondaryOutlineButtonClassName } from "@/components/design-system";
import { cn } from "@/lib/utils";

/** Main blue accent — auth CTAs, checkboxes, and inline links. */
export const AUTH_ACCENT_BLUE = "#2563EB";
export const AUTH_ACCENT_BLUE_HOVER = "#1D4ED8";

/** Figma: Inter Regular 14/20, fill #2563EB (e.g. Forgot password?, Get a free trial). */
export const authAccentLinkClassName =
  "text-[14px] font-normal leading-5 text-[#2563EB] transition-colors hover:text-[#1D4ED8]";

export function AuthTitleBlock({
  title,
  subtitle,
}: {
  title: string;
  subtitle: ReactNode;
}) {
  return (
    <div className="mb-7">
      <h1 className="text-[26px] font-semibold tracking-tight text-[#09090B]">{title}</h1>
      <div className="mt-2 text-sm leading-6 text-[#52525B]">{subtitle}</div>
    </div>
  );
}

export function AuthLabel({ children }: { children: ReactNode }) {
  return <label className="mb-1.5 block text-sm font-medium text-[#09090B]">{children}</label>;
}

/** Figma input: 40px tall, #F4F4F5 fill, 20px left / 8px vertical padding. */
export const authInputClassName = cn(
  "h-10 max-h-10 w-full rounded-[10px] border border-transparent bg-[#F4F4F5] py-2 pl-5 text-sm text-[#09090B]",
  "outline-none transition-colors duration-100",
  "placeholder:text-[#A1A1AA] focus:border-[#D4D4D8] focus:bg-[#EBEBEB] focus:ring-0",
  "disabled:cursor-not-allowed disabled:opacity-60",
);

export function AuthInput({
  value,
  onChange,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  const isControlled = value !== undefined || onChange !== undefined;

  return (
    <input
      {...props}
      onChange={onChange}
      {...(isControlled ? { value: value ?? "" } : {})}
      className={cn(authInputClassName, "pr-5", className)}
    />
  );
}

export function AuthPrimaryButton({
  children,
  type = "submit",
  disabled,
  onClick,
}: {
  children: ReactNode;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="flex h-[44px] w-full items-center justify-center gap-2 rounded-[10px] bg-[#2563EB] px-4 text-sm font-semibold text-white shadow-[0px_1px_2px_0px_rgba(37,99,235,0.25)] transition-colors duration-100 hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export function AuthSecondaryButton({
  children,
  type = "button",
  disabled,
  onClick,
}: {
  children: ReactNode;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        secondaryOutlineButtonClassName,
        "h-10 w-full px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60",
      )}
    >
      {children}
    </button>
  );
}

export function AuthCheckbox({
  checked,
  onCheckedChange,
  disabled,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
  "aria-label": string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/30 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-60",
        checked
          ? "border-[#2563EB] bg-[#2563EB] hover:border-[#1D4ED8] hover:bg-[#1D4ED8]"
          : "border-[#D4D4D8] bg-white hover:bg-[#F4F4F5]",
      )}
    >
      {checked ? <Check className="h-3 w-3 text-white" strokeWidth={3} aria-hidden /> : null}
    </button>
  );
}

export function AuthDivider({ label = "or" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 border-t border-[#E4E4E7]" aria-hidden />
      <span className="text-[14px] font-medium uppercase leading-6 text-[#71717A]">{label}</span>
      <div className="flex-1 border-t border-[#E4E4E7]" aria-hidden />
    </div>
  );
}

export function AuthMutedLink({
  children,
  href,
}: {
  children: ReactNode;
  href: string;
}) {
  return (
    <a
      href={href}
      className="font-semibold text-[#09090B] underline decoration-[#E4E4E7] underline-offset-4 transition-colors hover:decoration-[#A1A1AA]"
    >
      {children}
    </a>
  );
}

