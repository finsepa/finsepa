type UserAvatarProps = {
  /** Resolved image URL (remote or blob) or null to show initials. */
  imageSrc: string | null;
  initials: string;
  size: "sm" | "lg";
};

const smShell =
  "flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#09090B] text-[11px] font-semibold text-white";
const lgShell =
  "flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#F4F4F5] text-lg font-semibold text-[#52525B] ring-1 ring-[#E4E4E7]";

export function UserAvatar({ imageSrc, initials, size }: UserAvatarProps) {
  const shell = size === "sm" ? smShell : lgShell;
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
