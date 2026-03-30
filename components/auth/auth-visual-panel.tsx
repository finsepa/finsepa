import type { ReactNode } from "react";

import { AuthBrandMark } from "./auth-brand-mark";

export function AuthVisualPanel({
  mode = "marketing",
  title = "Market intelligence, refined.",
  subtitle = "Track, screen, and understand markets with a clean, focused workspace.",
  footer,
}: {
  mode?: "marketing" | "artwork";
  title?: string;
  subtitle?: string;
  footer?: ReactNode;
}) {
  if (mode === "artwork") {
    return (
      <div className="relative h-full w-full bg-[#09090B]">
        <img
          src="/auth-left-image.png"
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* Subtle premium darkening to improve logo contrast */}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/10 to-transparent" />

        <div className="absolute left-6 top-6">
          <AuthBrandMark className="h-7 w-7 filter invert" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_20%_20%,rgba(244,244,245,0.16),transparent_55%),radial-gradient(900px_circle_at_70%_80%,rgba(161,161,170,0.16),transparent_55%)]" />
        <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(to_right,rgba(244,244,245,0.10)_1px,transparent_1px),linear-gradient(to_bottom,rgba(244,244,245,0.08)_1px,transparent_1px)] [background-size:64px_64px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40" />
      </div>

      {/* Content */}
      <div className="relative flex h-full flex-col justify-between p-10">
        <div className="flex items-center gap-2 text-white/90">
          <img src="/logo.svg" alt="Finsepa" width={28} height={28} />
          <span className="text-sm font-semibold tracking-tight">Finsepa</span>
        </div>

        <div className="max-w-[420px]">
          <h2 className="text-3xl font-semibold tracking-tight text-white">{title}</h2>
          <p className="mt-3 text-sm leading-6 text-white/70">{subtitle}</p>
        </div>

        <div className="text-xs leading-5 text-white/55">
          {footer ?? (
            <span>
              By continuing, you agree to our Terms and acknowledge our Privacy Policy.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

