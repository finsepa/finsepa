import type { ReactNode } from "react";

import { AuthBrandMark } from "./auth-brand-mark";

export function AuthCenteredLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F7F7] p-4">
      <div className="w-full max-w-[420px] rounded-[12px] bg-white p-8 shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
        <div className="flex justify-center">
          <AuthBrandMark className="h-7 w-7" />
        </div>

        <div className="mt-6 text-center">
          <h1 className="text-[26px] font-semibold tracking-tight text-[#09090B]">{title}</h1>
          <div className="mt-2 text-sm leading-6 text-[#71717A]">{subtitle}</div>
        </div>

        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}

