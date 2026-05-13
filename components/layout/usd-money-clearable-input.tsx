"use client";

import { ClearableInput } from "@/components/layout/clearable-input";
import {
  formatUsdMoney2dp,
  parseUsdStyleNumber,
  sanitizeUsdMoneyTyping,
} from "@/lib/portfolio/amount-input-format";

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  clearLabel?: string;
  "aria-label"?: string;
};

export function UsdMoneyClearableInput({
  id,
  value,
  onChange,
  placeholder = "0.00",
  clearLabel = "Clear",
  "aria-label": ariaLabel,
}: Props) {
  const handleBlur = () => {
    const t = value.trim();
    if (!t) {
      onChange("");
      return;
    }
    onChange(formatUsdMoney2dp(parseUsdStyleNumber(t)));
  };

  return (
    <ClearableInput
      id={id}
      type="text"
      inputMode="decimal"
      value={value}
      onChange={(v) => onChange(sanitizeUsdMoneyTyping(v))}
      onBlur={handleBlur}
      placeholder={placeholder}
      clearLabel={clearLabel}
      aria-label={ariaLabel}
    />
  );
}
