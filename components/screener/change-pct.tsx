import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon } from "@hugeicons-pro/core-solid-standard";
import { cn } from "@/lib/utils";

/**
 * Hugeicons Pro solid-standard `ArrowDown01Icon` (up = rotated).
 * Same glyph as iOS list change carets.
 */
export function ChangeCaretIcon({
  direction,
  className,
  size = 14,
}: {
  direction: "up" | "down";
  className?: string;
  /** Square edge length in px (default 14). */
  size?: number;
}) {
  return (
    <HugeiconsIcon
      icon={ArrowDown01Icon}
      size={size}
      color="currentColor"
      className={cn(
        "block shrink-0 grow-0",
        direction === "up" && "rotate-180",
        className,
      )}
      aria-hidden
    />
  );
}

export function formatSignedChangePct(value: number): string {
  return `${Math.abs(value).toFixed(2)}%`;
}

/**
 * Inline header change: optional signed abs, then caret + abs % (equal gaps).
 * Dollar/abs keeps `+/-`; % does not.
 */
export function ChangePctParen({
  value,
  absText,
  className,
  caretSize = 14,
}: {
  value: number;
  /** When set, rendered before the caret with the same gap as after. */
  absText?: string;
  className?: string;
  caretSize?: number;
}) {
  const positive = value >= 0;
  return (
    <span className={cn("inline-flex items-baseline gap-0.5 tabular-nums", className)}>
      {absText != null ? <span className="whitespace-nowrap">{absText}</span> : null}
      <ChangeCaretIcon
        direction={positive ? "up" : "down"}
        size={caretSize}
        className="self-center"
      />
      <span className="whitespace-nowrap">{formatSignedChangePct(value)}</span>
    </span>
  );
}

type ChangePctProps = {
  value: number | null | undefined;
  className?: string;
  /** Text size / weight classes for the percent digits. */
  textClassName?: string;
  /** When true, omit the caret (still colors the %). */
  hideCaret?: boolean;
};

/**
 * Right-aligned signed % with a filled up/down caret.
 * Missing / non-finite → muted dash.
 */
export function ChangePct({
  value,
  className,
  textClassName = "text-[14px] leading-5 font-medium",
  hideCaret = false,
}: ChangePctProps) {
  if (value == null || !Number.isFinite(value)) {
    return (
      <div className={cn("min-w-0 w-full text-right text-fg-muted", textClassName, className)}>
        -
      </div>
    );
  }

  const positive = value >= 0;
  return (
    <div
      className={cn(
        "flex min-w-0 w-full items-center justify-end gap-0.5 tabular-nums",
        textClassName,
        className,
        // After `className` so pad/`text-fg` cell tokens don't override up/down.
        positive ? "text-up" : "text-down",
      )}
    >
      {hideCaret ? null : <ChangeCaretIcon direction={positive ? "up" : "down"} />}
      <span className="shrink-0 whitespace-nowrap">{formatSignedChangePct(value)}</span>
    </div>
  );
}
