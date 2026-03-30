import type { ImgHTMLAttributes } from "react";

export function AuthBrandMark({
  className,
  alt = "Finsepa",
  ...props
}: Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> & { alt?: string }) {
  return (
    <img
      src="/logo.svg"
      alt={alt}
      width={28}
      height={28}
      className={className}
      {...props}
    />
  );
}

