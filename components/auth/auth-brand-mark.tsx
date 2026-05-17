import type { ImgHTMLAttributes } from "react";

/** Rounded-square Finsepa mark for auth cards (login, signup, etc.). */
export const AUTH_BRAND_LOGO_SRC = "/auth-brand-logo.png";
export const AUTH_BRAND_LOGO_SIZE_PX = 52;

export function AuthBrandMark({
  className = "h-[52px] w-[52px]",
  alt = "Finsepa",
  size = AUTH_BRAND_LOGO_SIZE_PX,
  ...props
}: Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "width" | "height"> & {
  alt?: string;
  size?: number;
}) {
  return (
    <img
      src={AUTH_BRAND_LOGO_SRC}
      alt={alt}
      width={size}
      height={size}
      className={className}
      {...props}
    />
  );
}
