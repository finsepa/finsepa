type UserAvatarSize = "sm" | "md" | "menu" | "portfolios" | "lg" | "xl";

type UserAvatarProps = {
  /** Resolved image URL (remote or blob) or null to show initials. */
  imageSrc: string | null;
  initials: string;
  /** `sm` = 28px, `md` = 32px, `menu` = 40px (topbar profile menu), `portfolios` = 56px, `lg` = 80px, `xl` = 60px donut. */
  size: UserAvatarSize;
  /** Black circle + white crown at bottom-right (active Pro subscription). */
  showProBadge?: boolean;
};

const smShell =
  "flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#141414] text-[11px] font-semibold text-white";
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
  /** Topbar trigger — keep black disc + white crown readable on 28px avatar. */
  sm: { shell: "h-4 w-4 -bottom-px -right-px", icon: "h-2.5 w-2.5" },
  md: { shell: "h-4 w-4 -bottom-px -right-px", icon: "h-2.5 w-2.5" },
  menu: { shell: "h-4 w-4 -bottom-px -right-px", icon: "h-2.5 w-2.5" },
  portfolios: { shell: "h-4 w-4 bottom-0 right-0", icon: "h-2.5 w-2.5" },
  lg: { shell: "h-5 w-5 bottom-0.5 right-0.5", icon: "h-3 w-3" },
  xl: { shell: "h-4 w-4 bottom-0 right-0", icon: "h-2.5 w-2.5" },
};

/** Three-peak crown — sized to leave a clear black ring around the glyph (matches dropdown). */
function ProCrownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" className={className} aria-hidden>
      <path
        fill="#fff"
        d="M1.5 9.25V4.1l1.9 1.55L6 2.25l2.6 3.4 1.9-1.55v5.15H1.5Z"
      />
      <path fill="#fff" d="M1.75 9.75h8.5V11h-8.5V9.75Z" />
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
    <div className={`${shell} relative`}>
      <span aria-hidden>{initials}</span>
      {imageSrc ? (
        <img src={imageSrc} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
    </div>
  );

  if (!showProBadge) return avatar;

  const badge = proBadgeBySize[size];

  return (
    <span className="relative inline-flex shrink-0">
      {avatar}
      <span
        className={`absolute z-[1] flex items-center justify-center overflow-hidden rounded-full bg-[#141414] ring-2 ring-white ${badge.shell}`}
        title="Pro"
        aria-label="Pro"
      >
        <ProCrownIcon className={badge.icon} />
      </span>
    </span>
  );
}
