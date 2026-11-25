"use client";

import { FinsepaLogo } from "@/components/brand/finsepa-logo";
import {
  DEFAULT_PORTFOLIO_ACCENT_COLOR,
  DEFAULT_PORTFOLIO_ICON_ID,
  PORTFOLIO_ACCENT_COLORS,
  PORTFOLIO_ICON_IDS,
  portfolioAccentIconClassName,
  portfolioHasCustomAppearance,
  type PortfolioAccentColor,
  type PortfolioIconId,
} from "@/lib/portfolio/portfolio-appearance";
import { PortfolioIconMark, PORTFOLIO_ICON_LABELS } from "@/components/portfolio/portfolio-icon-mark";
import { Lock } from "@/lib/icons";
import { cn } from "@/lib/utils";

export type PortfolioAppearanceValue = {
  /** `null` = classic Finsepa list tile (theme-aware). */
  accentColor: PortfolioAccentColor | null;
  iconId: PortfolioIconId;
};

export const DEFAULT_PORTFOLIO_APPEARANCE: PortfolioAppearanceValue = {
  accentColor: null,
  iconId: DEFAULT_PORTFOLIO_ICON_ID,
};

/** Same plate as {@link PortfolioListLogo} — light surface / dark white + black mark. */
function ClassicFinsepaPreviewMark({ size }: { size: number }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-stroke bg-surface",
        "shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-06))]",
        "dark:border-transparent dark:bg-white dark:shadow-[0px_1px_2px_0px_rgba(0,0,0,0.24)]",
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <FinsepaLogo
        size={Math.round(size * 0.5)}
        className="text-fg dark:text-[#141414]"
        title=""
      />
    </div>
  );
}

/** Live preview tile for the create-portfolio modal — name field lives under the icon. */
export function PortfolioAppearancePreview({
  name,
  onNameChange,
  accentColor,
  iconId,
}: {
  name: string;
  onNameChange: (name: string) => void;
  accentColor: PortfolioAccentColor | null;
  iconId: PortfolioIconId;
}) {
  const custom = portfolioHasCustomAppearance({ accentColor, iconId });
  const tileColor = accentColor ?? DEFAULT_PORTFOLIO_ACCENT_COLOR;

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-stroke bg-surface-muted/60 px-4 py-5 dark:border-stroke-shell dark:bg-surface/40">
      {custom ? (
        <div
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-full shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-06))]",
            portfolioAccentIconClassName(tileColor),
          )}
          style={{ backgroundColor: tileColor }}
          aria-hidden
        >
          <PortfolioIconMark
            iconId={iconId}
            size={28}
            className={portfolioAccentIconClassName(tileColor)}
          />
        </div>
      ) : (
        <ClassicFinsepaPreviewMark size={56} />
      )}
      <input
        type="text"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="Portfolio name"
        aria-label="Portfolio name"
        className="w-full min-w-0 bg-transparent text-center text-base font-semibold text-fg outline-none placeholder:text-fg-muted"
        autoComplete="off"
        autoFocus
      />
    </div>
  );
}

/** Small Pro lock badge on the corner of a circular swatch / icon button. */
function AppearanceProLockBadge() {
  return (
    <span
      className="pointer-events-none absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-fg text-surface shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-10))]"
      aria-hidden
    >
      <Lock className="h-2.5 w-2.5" strokeWidth={2.5} />
    </span>
  );
}

export function PortfolioAppearancePicker({
  value,
  onChange,
  locked = false,
  onLockedClick,
}: {
  value: PortfolioAppearanceValue;
  onChange: (next: PortfolioAppearanceValue) => void;
  /** Free plan — show lock badges and block changes. */
  locked?: boolean;
  onLockedClick?: () => void;
}) {
  const guard = (apply: () => void) => {
    if (locked) {
      onLockedClick?.();
      return;
    }
    apply();
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-2 text-sm font-medium text-fg">Color</div>
        <div className="grid grid-cols-6 gap-2.5">
          {PORTFOLIO_ACCENT_COLORS.map((color) => {
            const selected = value.accentColor === color;
            return (
              <button
                key={color}
                type="button"
                aria-label={locked ? `Color ${color} (Pro)` : `Color ${color}`}
                aria-pressed={selected}
                onClick={() =>
                  guard(() =>
                    onChange({
                      ...value,
                      // Toggle off → back to classic Finsepa plate when icon is default.
                      accentColor: selected ? null : color,
                    }),
                  )
                }
                className={cn(
                  "relative mx-auto flex h-9 w-9 items-center justify-center rounded-full transition-transform",
                  selected ? "scale-105" : "hover:scale-105",
                )}
              >
                {selected ? (
                  <span
                    className="absolute inset-0 rounded-full ring-2 ring-fg/80 ring-offset-2 ring-offset-dropdown dark:ring-offset-page"
                    aria-hidden
                  />
                ) : null}
                <span
                  className="h-8 w-8 rounded-full border border-black/5 dark:border-white/10"
                  style={{ backgroundColor: color }}
                />
                {locked ? <AppearanceProLockBadge /> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm font-medium text-fg">Icon</div>
        <div className="grid grid-cols-6 gap-2">
          {PORTFOLIO_ICON_IDS.map((id) => {
            const selected = value.iconId === id;
            const isDefaultIcon = id === DEFAULT_PORTFOLIO_ICON_ID;
            // Default Finsepa mark stays free; other icons are Pro-gated.
            const iconLocked = locked && !isDefaultIcon;
            return (
              <button
                key={id}
                type="button"
                aria-label={
                  iconLocked ? `${PORTFOLIO_ICON_LABELS[id]} (Pro)` : PORTFOLIO_ICON_LABELS[id]
                }
                aria-pressed={selected}
                onClick={() => {
                  if (iconLocked) {
                    onLockedClick?.();
                    return;
                  }
                  // Non-Finsepa icons need a color plate; keep choice or fall back to default blue.
                  if (!isDefaultIcon && value.accentColor == null) {
                    onChange({ accentColor: DEFAULT_PORTFOLIO_ACCENT_COLOR, iconId: id });
                    return;
                  }
                  // Selecting default clears a Pro color plate on Free (classic tile).
                  if (isDefaultIcon && locked) {
                    onChange({ accentColor: null, iconId: id });
                    return;
                  }
                  onChange({ ...value, iconId: id });
                }}
                className={cn(
                  "relative flex h-10 w-10 items-center justify-center rounded-full border transition-colors",
                  selected
                    ? "border-fg bg-surface text-fg shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-06))]"
                    : "border-transparent bg-surface-muted text-fg-muted hover:bg-surface-hover hover:text-fg dark:bg-surface/50",
                )}
              >
                <PortfolioIconMark iconId={id} size={18} />
                {iconLocked ? <AppearanceProLockBadge /> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
