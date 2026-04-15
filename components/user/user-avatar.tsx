type UserAvatarProps = {
  /** Resolved image URL (remote or blob) or null to show initials. */
  imageSrc: string | null;
  initials: string;
  /** `sm` = 28px, `md` = 32px, `menu` = 40px (topbar profile menu), `portfolios` = 56px, `lg` = 80px, `xl` = 72px donut. */
  size: "sm" | "md" | "menu" | "portfolios" | "lg" | "xl";
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
  "flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#F4F4F5] text-lg font-semibold text-[#52525B] ring-4 ring-white shadow-[0px_1px_4px_0px_rgba(10,10,10,0.08)]";

export function UserAvatar({ imageSrc, initials, size }: UserAvatarProps) {
  const shell =
    size === "sm" ? smShell
    : size === "md" ? mdShell
    : size === "menu" ? menuShell
    : size === "portfolios" ? portfoliosShell
    : size === "xl" ? xlShell
    : lgShell;
  return (
    <div className={shell}>
      {imageSrc ? (
        <img src={imageSrc} alt="" className="h-full w-full object-cover" />
      ) : (
        initials
      )}
    </div>
  );
}
