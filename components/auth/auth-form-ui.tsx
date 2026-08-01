import { Check } from "@/lib/icons";
import type { InputHTMLAttributes, ReactNode } from "react";

import { whiteSurfaceButtonChromeClass } from "@/components/design-system";
import { fieldChromeClassName } from "@/components/design-system/text-input-styles";
import { cn } from "@/lib/utils";

/** Main blue accent — auth CTAs, checkboxes, and inline links. */
export const AUTH_ACCENT_BLUE = "var(--fs-accent)";
export const AUTH_ACCENT_BLUE_HOVER = "var(--fs-accent-hover)";

/** Figma: Inter Regular 14/20, fill accent (e.g. Forgot password?, Get a free trial). */
export const authAccentLinkClassName =
  "text-[14px] font-normal leading-5 text-accent transition-colors hover:text-accent-hover";

/** Error / warning banner — light #FEF2F2 / #B91C1C; dark uses down-soft wash. */
export const authAlertBannerClassName =
  "rounded-[10px] border border-alert-border bg-alert px-3 py-2 text-sm leading-5 text-alert-fg";

/** Success / confirmation banner (signed in, password updated, email sent, …). */
export const authSuccessBannerClassName =
  "rounded-[10px] border border-success-border bg-success px-3 py-2 text-sm leading-5 text-success-fg";

/** Info banner (e.g. signed out) — soft blue wash, same pattern as red/green alerts. */
export const authInfoBannerClassName =
  "rounded-[10px] border border-info-border bg-info px-3 py-2 text-sm leading-5 text-info-fg";

/** Soft warning banner (e.g. sign-ups paused). */
export const authWarningBannerClassName =
  "rounded-[10px] border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-sm leading-5 text-[#92400E]";

export function AuthTitleBlock({
  title,
  subtitle,
}: {
  title: string;
  subtitle: ReactNode;
}) {
  return (
    <div className="mb-7">
      <h1 className="text-[26px] font-semibold tracking-tight text-fg">{title}</h1>
      <div className="mt-2 text-sm leading-6 text-fg-muted">{subtitle}</div>
    </div>
  );
}

export function AuthLabel({ children }: { children: ReactNode }) {
  return <label className="mb-1.5 block text-sm font-medium text-fg">{children}</label>;
}

/**
 * Auth text field chrome — same field tokens / focus ring as app inputs.
 * Keeps auth sizing (40px / 10px radius / pl-5); dark uses panel well so the
 * control still reads on `bg-surface` auth cards (field hex matches surface).
 */
export const authInputClassName = cn(
  "h-10 max-h-10 w-full rounded-[10px] py-2 pl-5 text-sm text-fg",
  fieldChromeClassName,
  "outline-none transition-[color,background-color,border-color,box-shadow]",
  "placeholder:text-fg-subtle",
  "dark:bg-panel dark:[&:not(:focus)]:hover:border-field-stroke-hover",
  "focus:shadow-[0_0_0_2px_var(--fs-field-ring)] focus:ring-0 focus-visible:outline-none",
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

/** 48px CTA height — login / signup / forgot-password only (not reset-password, check-email, ops). */
export const authEntryCtaClassName = "h-12";

export function AuthPrimaryButton({
  children,
  type = "submit",
  disabled,
  onClick,
  className,
}: {
  children: ReactNode;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-[44px] w-full items-center justify-center gap-2 rounded-[10px] bg-accent px-4 text-sm font-semibold text-white shadow-[0px_1px_2px_0px_rgba(54,74,255,0.25)] transition-colors duration-100 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
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
  className,
}: {
  children: ReactNode;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  // Stable class string (no `cn`/`twMerge`) — avoids chrome hydration mismatch.
  const resolvedClassName = [
    "inline-flex w-full items-center justify-center gap-2 rounded-[10px] px-4 text-sm font-semibold text-fg",
    whiteSurfaceButtonChromeClass,
    "transition-colors duration-100 hover:bg-surface-muted dark:hover:bg-dropdown-item-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/15",
    "disabled:cursor-not-allowed disabled:opacity-60",
    "h-10",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      suppressHydrationWarning
      className={resolvedClassName}
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
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-60",
        checked
          ? "border-accent bg-accent hover:border-accent-hover hover:bg-accent-hover"
          : "border-stroke bg-surface hover:bg-surface-muted",
      )}
    >
      {checked ? <Check className="h-3 w-3 text-white" strokeWidth={3} aria-hidden /> : null}
    </button>
  );
}

export function AuthDivider({ label = "or" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 border-t border-stroke" aria-hidden />
      <span className="text-[14px] font-medium uppercase leading-6 text-fg-muted">{label}</span>
      <div className="flex-1 border-t border-stroke" aria-hidden />
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
      className="font-semibold text-fg underline decoration-stroke underline-offset-4 transition-colors hover:decoration-fg-subtle"
    >
      {children}
    </a>
  );
}

