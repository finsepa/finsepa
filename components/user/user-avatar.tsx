import { cn } from "@/lib/utils";

type UserAvatarSize = "sm" | "md" | "menu" | "portfolios" | "lg" | "xl";

type UserAvatarProps = {
  /** Resolved image URL (remote or blob) or null to show initials. */
  imageSrc: string | null;
  initials: string;
  /** `sm` = 28px, `md` = 32px, `menu` = 40px (topbar profile menu), `portfolios` = 56px, `lg` = 80px, `xl` = 60px donut. */
  size: UserAvatarSize;
  /** Crown badge at bottom-right (active Pro subscription). */
  showProBadge?: boolean;
};

/** Shared initials shell — muted surface in light + dark (avoids white `bg-fg` disc on dark). */
const SHELL_BASE =
  "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-muted font-semibold text-fg-muted";

const shellBySize: Record<UserAvatarSize, string> = {
  sm: cn(SHELL_BASE, "h-7 w-7 text-[11px]"),
  md: cn(SHELL_BASE, "h-8 w-8 text-[11px]"),
  menu: cn(SHELL_BASE, "h-10 w-10 text-[13px]"),
  portfolios: cn(SHELL_BASE, "h-14 w-14 text-lg ring-1 ring-stroke"),
  lg: cn(SHELL_BASE, "h-20 w-20 text-lg ring-1 ring-stroke"),
  /** Center of portfolio allocation donut — pale ring on colored slices. */
  xl: cn(
    SHELL_BASE,
    "h-[60px] w-[60px] text-base ring-[1px] ring-white shadow-[0px_1px_4px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-08))]",
  ),
};

const proBadgeBySize: Record<UserAvatarSize, { shell: string; icon: string }> = {
  sm: { shell: "h-4 w-4 -bottom-px -right-px", icon: "h-2.5 w-2.5" },
  md: { shell: "h-4 w-4 -bottom-px -right-px", icon: "h-2.5 w-2.5" },
  menu: { shell: "h-4 w-4 -bottom-px -right-px", icon: "h-2.5 w-2.5" },
  portfolios: { shell: "h-4 w-4 bottom-0 right-0", icon: "h-2.5 w-2.5" },
  lg: { shell: "h-5 w-5 bottom-0.5 right-0.5", icon: "h-3 w-3" },
  xl: { shell: "h-4 w-4 bottom-0 right-0", icon: "h-2.5 w-2.5" },
};

/** Three-peak crown — uses `currentColor` (white on light theme badge, dark on dark theme). */
function ProCrownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M1.5 9.25V4.1l1.9 1.55L6 2.25l2.6 3.4 1.9-1.55v5.15H1.5Z"
      />
      <path fill="currentColor" d="M1.75 9.75h8.5V11h-8.5V9.75Z" />
    </svg>
  );
}

export function UserAvatar({ imageSrc, initials, size, showProBadge = false }: UserAvatarProps) {
  const src = typeof imageSrc === "string" && imageSrc.trim() ? imageSrc.trim() : null;
  const label = (initials || "?").slice(0, 3);

  const avatar = (
    <div
      className={cn(shellBySize[size], "relative")}
      // Topbar can hydrate with a fresher avatar URL / initials than SSR claims.
      suppressHydrationWarning
    >
      <span aria-hidden suppressHydrationWarning>
        {label}
      </span>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote user avatars + blob previews
        <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" suppressHydrationWarning />
      ) : null}
    </div>
  );

  if (!showProBadge) return avatar;

  const badge = proBadgeBySize[size];

  return (
    <span className="relative inline-flex shrink-0" suppressHydrationWarning>
      {avatar}
      <span
        className={cn(
          "absolute z-[1] flex items-center justify-center overflow-hidden rounded-full",
          // Light: black disc + white crown; dark: inverted (fg/surface swap).
          // Ring matches secondary button fill (`--fs-button`).
          "border-2 border-button bg-fg text-surface shadow-sm",
          badge.shell,
        )}
        title="Pro"
        aria-label="Pro"
        suppressHydrationWarning
      >
        <ProCrownIcon className={badge.icon} />
      </span>
    </span>
  );
}
