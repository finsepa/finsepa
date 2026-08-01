"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

import { whiteSurfaceButtonChromeClass } from "@/components/design-system/secondary-button-styles";
import { TopbarDelayedTooltip } from "@/components/layout/topbar-delayed-tooltip";
import { Mail, Moon, Sun } from "@/lib/icons";
import { cn } from "@/lib/utils";

const HELP_EMAIL = "hi@finsepa.com";

/** 40px circle + 20px icon — auth entry pages only (login / signup / forgot password). */
const AUTH_CORNER_BUTTON_CLASS = cn(
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
  whiteSurfaceButtonChromeClass,
  "text-icon transition-all duration-100 hover:bg-surface-muted dark:hover:bg-dropdown-item-hover",
);

/**
 * Fixed bottom-right theme + help controls for auth entry screens.
 */
export function AuthCornerActions() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <div
      className={cn(
        "pointer-events-none fixed z-30 flex flex-col gap-2",
        "bottom-4 right-4 sm:bottom-6 sm:right-6",
      )}
    >
      <TopbarDelayedTooltip
        label={isDark ? "Switch to light" : "Switch to dark"}
        placement="left"
        align="trailing"
        className="pointer-events-auto"
      >
        <button
          type="button"
          aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
          suppressHydrationWarning
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className={AUTH_CORNER_BUTTON_CLASS}
        >
          {isDark ? (
            <Sun className="size-5" strokeWidth={1.75} aria-hidden />
          ) : (
            <Moon className="size-5" strokeWidth={1.75} aria-hidden />
          )}
        </button>
      </TopbarDelayedTooltip>

      <TopbarDelayedTooltip label="Help" placement="left" align="trailing" className="pointer-events-auto">
        <a
          href={`mailto:${HELP_EMAIL}`}
          aria-label={`Email help at ${HELP_EMAIL}`}
          className={AUTH_CORNER_BUTTON_CLASS}
        >
          <Mail className="size-5" strokeWidth={1.75} aria-hidden />
        </a>
      </TopbarDelayedTooltip>
    </div>
  );
}
