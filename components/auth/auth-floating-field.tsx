"use client";

import { Eye, EyeOff, XCircle } from "@/lib/icons";
import {
  useId,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/**
 * Login / Sign up only — Link-style floating label inside the existing auth input chrome.
 * Do not reuse elsewhere; other auth pages keep static AuthLabel + AuthInput.
 */
const floatingShellClassName = cn(
  "relative h-12 w-full rounded-[10px] border border-transparent bg-[#F4F4F5]",
  "transition-colors duration-100",
  "focus-within:border-[#D4D4D8] focus-within:bg-[#EBEBEB]",
  "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60",
);

const floatingInputClassName = cn(
  "peer h-full w-full rounded-[10px] border-0 bg-transparent pt-5 pb-1.5 pl-4 text-sm text-[#0F0F0F]",
  "outline-none ring-0",
  "disabled:cursor-not-allowed",
);

const floatingIconButtonClassName = cn(
  "pointer-events-auto absolute inset-y-0 flex items-center text-[#71717A] transition-opacity",
  "hover:text-[#0F0F0F] hover:opacity-80",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/30",
  "disabled:cursor-not-allowed disabled:opacity-60",
);

const floatingTrailingIconClassName = "size-[18px] shrink-0 text-[#71717A]";

function FloatingLabel({
  htmlFor,
  floated,
  children,
}: {
  htmlFor: string;
  floated: boolean;
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "pointer-events-none absolute left-4 top-0 origin-left text-sm leading-5",
        floated ? "font-medium text-[#71717A]" : "font-normal text-[#A1A1AA]",
      )}
      style={{
        // Inline transform so the browser interpolates big→small (Tailwind class swaps can snap).
        // 48px field: rest centered ((48-20)/2 = 14px); floated near top (+1px gap to value text).
        transform: floated
          ? "translateY(5px) scale(0.785)"
          : "translateY(14px) scale(1)",
        transition:
          "transform 220ms cubic-bezier(0.2, 0, 0, 1), color 220ms cubic-bezier(0.2, 0, 0, 1)",
      }}
    >
      {children}
    </label>
  );
}

function emitClear(
  onChange: ((event: ChangeEvent<HTMLInputElement>) => void) | undefined,
  name: string | undefined,
) {
  onChange?.({
    target: { value: "", name: name ?? "" },
    currentTarget: { value: "", name: name ?? "" },
  } as ChangeEvent<HTMLInputElement>);
}

export function AuthFloatingInput({
  label,
  value,
  onChange,
  onFocus,
  onBlur,
  id,
  className,
  requiredMark,
  disabled,
  name,
  trailingLoading = false,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "placeholder"> & {
  label: string;
  /** Signup required asterisk inside the floating label. */
  requiredMark?: boolean;
  /** Show a spinner in the trailing slot (e.g. email lookup) instead of clear. */
  trailingLoading?: boolean;
}) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [focused, setFocused] = useState(false);
  const hasValue = String(value ?? "").length > 0;
  const floated = focused || hasValue;
  const showTrailing = trailingLoading || hasValue;

  return (
    <div className={cn(floatingShellClassName, className)}>
      <input
        {...props}
        id={inputId}
        name={name}
        disabled={disabled}
        value={value ?? ""}
        onChange={onChange}
        placeholder=" "
        className={cn(floatingInputClassName, showTrailing ? "pr-[34px]" : "pr-4")}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
      />
      <FloatingLabel htmlFor={inputId} floated={floated}>
        {label}
        {requiredMark ? <span className="text-[#DC2626]"> *</span> : null}
      </FloatingLabel>
      {trailingLoading ? (
        <div
          className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4"
          aria-hidden
        >
          <Spinner className="size-[18px] text-[#71717A]" />
        </div>
      ) : hasValue ? (
        <button
          type="button"
          disabled={disabled}
          className={cn(floatingIconButtonClassName, "right-0 pr-4")}
          aria-label={`Clear ${label}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => emitClear(onChange, name)}
        >
          <XCircle className={floatingTrailingIconClassName} strokeWidth={2} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

export function AuthFloatingPasswordInput({
  label,
  value,
  onChange,
  onFocus,
  onBlur,
  id,
  className,
  requiredMark,
  disabled,
  name,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "placeholder" | "type"> & {
  label: string;
  requiredMark?: boolean;
}) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const hasValue = String(value ?? "").length > 0;
  const floated = focused || hasValue;
  const showPlain = visible && hasValue;

  return (
    <div className={cn(floatingShellClassName, className)}>
      <input
        {...props}
        id={inputId}
        name={name}
        value={value ?? ""}
        onChange={onChange}
        disabled={disabled}
        type={showPlain ? "text" : "password"}
        placeholder=" "
        className={cn(floatingInputClassName, hasValue ? "pr-[62px]" : "pr-4")}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
      />
      <FloatingLabel htmlFor={inputId} floated={floated}>
        {label}
        {requiredMark ? <span className="text-[#DC2626]"> *</span> : null}
      </FloatingLabel>
      {hasValue ? (
        <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-4">
          <button
            type="button"
            disabled={disabled}
            className={cn(floatingIconButtonClassName, "relative inset-auto")}
            aria-label={`Clear ${label}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => emitClear(onChange, name)}
          >
            <XCircle className={floatingTrailingIconClassName} strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            disabled={disabled}
            className={cn(floatingIconButtonClassName, "relative inset-auto")}
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
          >
            {visible ? (
              <EyeOff className={floatingTrailingIconClassName} strokeWidth={2} aria-hidden />
            ) : (
              <Eye className={floatingTrailingIconClassName} strokeWidth={2} aria-hidden />
            )}
          </button>
        </div>
      ) : null}
    </div>
  );
}
