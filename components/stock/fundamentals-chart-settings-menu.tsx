"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Settings } from "@/lib/icons";

import {
  dropdownMenuPanelClassName,
  dropdownMenuPlainItemRowClassName,
} from "@/components/design-system/dropdown-menu-styles";
import { topbarSquircleActiveClass, topbarSquircleIconClass } from "@/components/design-system/topbar-control-classes";
import type { FundamentalsChartDisplayOptions } from "@/lib/chart/fundamentals-chart-display-options";
import { cn } from "@/lib/utils";

function PillSwitch({
  pressed,
  onPressedChange,
  "aria-label": ariaLabel,
}: {
  pressed: boolean;
  onPressedChange: (next: boolean) => void;
  "aria-label": string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={pressed}
      aria-label={ariaLabel}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15",
        pressed ? "bg-[#2563EB]" : "bg-[#E4E4E7]",
      )}
    >
      <span
        className={cn(
          "pointer-events-none absolute left-0.5 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform",
          pressed && "translate-x-4",
        )}
        aria-hidden
      />
    </button>
  );
}

/** Above metric chart modal shell (`300`). */
const SETTINGS_MENU_PANEL_Z = 310;

const BAR_TOGGLE_ROWS: {
  key: keyof FundamentalsChartDisplayOptions;
  label: string;
  ariaLabel: string;
}[] = [
  { key: "showAvgLine", label: "Avg. line", ariaLabel: "Show average line" },
  { key: "showMaxLine", label: "Max line", ariaLabel: "Show maximum line" },
  { key: "showMinLine", label: "Min line", ariaLabel: "Show minimum line" },
  { key: "showBarValues", label: "Values", ariaLabel: "Show values on chart" },
];

const LINE_TOGGLE_ROWS: {
  key: keyof FundamentalsChartDisplayOptions;
  label: string;
  ariaLabel: string;
  badgeKey: keyof FundamentalsChartSettingsLineBadges;
}[] = [
  { key: "showMaxLine", label: "Max", ariaLabel: "Show maximum line", badgeKey: "max" },
  { key: "showMinLine", label: "Min", ariaLabel: "Show minimum line", badgeKey: "min" },
];

/** Grey range-style pills (stock overview open/high badges). */
const LINE_SETTINGS_NEUTRAL_BADGE_CLASS =
  "inline-block shrink-0 rounded-[6px] bg-[#E4E4E7] px-1.5 py-0.5 text-[11px] font-medium leading-4 tabular-nums text-[#09090B] whitespace-nowrap";

export type FundamentalsChartSettingsLineBadges = {
  max: string;
  min: string;
};

type MenuAnchor = { top: number; right: number; width: number };

/** Three-column row: label · badge (right-aligned) · toggle. */
const LINE_SETTINGS_ROW_CLASS =
  "grid h-10 min-h-10 w-full shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 rounded-lg bg-white px-4 py-2 text-left transition-colors hover:bg-[#F4F4F5]";

export function FundamentalsChartSettingsMenu({
  options,
  onChange,
  variant = "bar",
  lineBadges,
  listboxZClassName,
  menuPanelZIndex = SETTINGS_MENU_PANEL_Z,
}: {
  options: FundamentalsChartDisplayOptions;
  onChange: (next: FundamentalsChartDisplayOptions) => void;
  /** Line chart: shorter labels with live max/min/value badges. */
  variant?: "bar" | "line";
  lineBadges?: FundamentalsChartSettingsLineBadges;
  /** Optional z-index on the trigger wrapper (menu is portaled separately). */
  listboxZClassName?: string;
  menuPanelZIndex?: number;
}) {
  const [open, setOpen] = useState(false);
  const [portalMounted, setPortalMounted] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPortalMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setMenuAnchor(null);
      return;
    }
    const update = () => {
      const rect = triggerRef.current!.getBoundingClientRect();
      setMenuAnchor({
        top: rect.bottom + 6,
        right: Math.max(16, window.innerWidth - rect.right),
        width: Math.min(window.innerWidth - 32, variant === "line" ? 280 : 240),
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, variant]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      e.preventDefault();
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  const menuPanel =
    open && menuAnchor && portalMounted
      ? createPortal(
          <div
            ref={menuRef}
            className={dropdownMenuPanelClassName("fixed")}
            style={{
              top: menuAnchor.top,
              right: menuAnchor.right,
              width: menuAnchor.width,
              zIndex: menuPanelZIndex,
            }}
            role="menu"
            aria-label="Chart display settings"
          >
            {variant === "line"
              ? LINE_TOGGLE_ROWS.map(({ key, label, ariaLabel, badgeKey }) => {
                  const badgeText = lineBadges?.[badgeKey];
                  return (
                    <div
                      key={key}
                      role="menuitem"
                      className={LINE_SETTINGS_ROW_CLASS}
                    >
                      <span className="shrink-0 text-sm font-medium leading-5 text-[#09090B]">
                        {label}
                      </span>
                      {badgeText ? (
                        <span className={cn("justify-self-end", LINE_SETTINGS_NEUTRAL_BADGE_CLASS)}>
                          {badgeText}
                        </span>
                      ) : (
                        <span className="justify-self-end" aria-hidden />
                      )}
                      <PillSwitch
                        pressed={options[key]}
                        onPressedChange={(next) => onChange({ ...options, [key]: next })}
                        aria-label={ariaLabel}
                      />
                    </div>
                  );
                })
              : BAR_TOGGLE_ROWS.map(({ key, label, ariaLabel }) => (
                  <div
                    key={key}
                    role="menuitem"
                    className={dropdownMenuPlainItemRowClassName()}
                  >
                    <span className="min-w-0 flex-1 text-sm font-medium leading-5 text-[#09090B]">
                      {label}
                    </span>
                    <PillSwitch
                      pressed={options[key]}
                      onPressedChange={(next) => onChange({ ...options, [key]: next })}
                      aria-label={ariaLabel}
                    />
                  </div>
                ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {menuPanel}
      <div className={cn("relative shrink-0", listboxZClassName)}>
        <button
          ref={triggerRef}
          type="button"
          aria-label="Chart display settings"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            topbarSquircleIconClass,
            "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/10 focus-visible:ring-offset-2",
            open && topbarSquircleActiveClass,
          )}
        >
          <Settings className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
        </button>
      </div>
    </>
  );
}
