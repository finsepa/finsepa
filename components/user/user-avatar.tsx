type UserAvatarSize = "sm" | "md" | "menu" | "portfolios" | "lg" | "xl";

type UserAvatarProps = {
  /** Resolved image URL (remote or blob) or null to show initials. */
  imageSrc: string | null;
  initials: string;
  /** `sm` = 28px, `md` = 32px, `menu` = 40px (topbar profile menu), `portfolios` = 56px, `lg` = 80px, `xl` = 60px donut. */
  size: UserAvatarSize;
  /** Black circle + white crown at top-right (active Pro subscription). */
  showProBadge?: boolean;
};

const smShell =
  "flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#09090B] text-[11px] font-semibold text-white";
/** Public portfolio cards — matches Figma avatar component (32×32). */
const mdShell =
  "flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#F4F4F5] text-[11px] font-semibold text-[#52525B]";
/** Topbar profile dropdown header — 40×40. */
const menuShell =
  "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#F4F4F5] text-[13px] font-semibold text-[#52525B]";
/** `/portfolios` directory — 56×56 per design. */
const portfoliosShell =
  "flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#F4F4F5] text-lg font-semibold text-[#52525B] ring-1 ring-[#E4E4E7]";
const lgShell =
  "flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#F4F4F5] text-lg font-semibold text-[#52525B] ring-1 ring-[#E4E4E7]";
/** Center of portfolio allocation donut — white ring reads on colored slices. */
const xlShell =
  "flex h-[60px] w-[60px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#F4F4F5] text-base font-semibold text-[#52525B] ring-[1px] ring-white shadow-[0px_1px_4px_0px_rgba(10,10,10,0.08)]";

const proBadgeBySize: Record<UserAvatarSize, { shell: string; icon: string }> = {
  sm: { shell: "h-3 w-3 -right-px -top-px", icon: "h-[7px] w-[7px]" },
  md: { shell: "h-3.5 w-3.5 right-0 top-0", icon: "h-2 w-2" },
  menu: { shell: "h-3.5 w-3.5 right-0 top-0", icon: "h-2 w-2" },
  portfolios: { shell: "h-4 w-4 right-0.5 top-0.5", icon: "h-2.5 w-2.5" },
  lg: { shell: "h-5 w-5 right-1 top-1", icon: "h-3 w-3" },
  xl: { shell: "h-4 w-4 right-0.5 top-0.5", icon: "h-2.5 w-2.5" },
};

function ProCrownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 10 10" className={className} aria-hidden fill="currentColor">
      <path d="M1.25 7.75V4.35l1.55 1.25L5 1.75l2.2 3.85 1.55-1.25v3.4H1.25Z" />
      <path d="M1.5 8.25h7v.75h-7v-.75Z" />
    </svg>
  );
}

export function UserAvatar({ imageSrc, initials, size, showProBadge = false }: UserAvatarProps) {
  const shell =
    size === "sm" ? smShell
    : size === "md" ? mdShell
    : size === "menu" ? menuShell
    : size === "portfolios" ? portfoliosShell
    : size === "xl" ? xlShell
    : lgShell;

  const avatar = (
    <div className={shell}>
      {imageSrc ? (
        <img src={imageSrc} alt="" className="h-full w-full object-cover" />
      ) : (
        initials
      )}
    </div>
  );

  if (!showProBadge) return avatar;

  const badge = proBadgeBySize[size];

  return (
    <span className="relative inline-flex shrink-0">
      {avatar}
      <span
        className={`absolute flex items-center justify-center rounded-full bg-[#09090B] text-white ring-2 ring-white ${badge.shell}`}
        title="Pro"
        aria-label="Pro"
      >
        <ProCrownIcon className={badge.icon} />
      </span>
    </span>
  );
}
