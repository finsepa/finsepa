"use client";

/**
 * Tab switcher (segmented control) — Finsepa design system.
 * Visual spec: grey-100 track, white raised pill for the active tab, sm shadow.
 * Source: Figma Web-App-Design Button Group (e.g. Annual / Quarterly on Charting).
 */
export type TabSwitcherOption<T extends string = string> = {
  value: T;
  label: string;
};

const TRACK =
  "flex items-center gap-0 rounded-[10px] bg-[#F4F4F5] p-0.5 text-[14px] font-medium leading-5";
const SEGMENT_BASE = "rounded-[10px] px-4 py-1.5 transition-colors";
const SEGMENT_ACTIVE =
  "bg-white text-[#09090B] shadow-[0px_1px_4px_0px_rgba(10,10,10,0.12),0px_1px_2px_0px_rgba(10,10,10,0.07)]";
const SEGMENT_INACTIVE = "text-[#71717A] hover:text-[#09090B]";

export function TabSwitcher<T extends string>({
  options,
  value,
  onChange,
  "aria-label": ariaLabel,
  className,
}: {
  options: readonly TabSwitcherOption<T>[];
  value: T;
  onChange: (next: T) => void;
  "aria-label"?: string;
  className?: string;
}) {
  return (
    <div
      className={[TRACK, className].filter(Boolean).join(" ")}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={`${SEGMENT_BASE} ${active ? SEGMENT_ACTIVE : SEGMENT_INACTIVE}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
