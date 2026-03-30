import type { ReactNode } from "react";

export function AuthSplitLayout({
  left,
  right,
  showLeftOnMobile = false,
}: {
  left: ReactNode;
  right: ReactNode;
  showLeftOnMobile?: boolean;
}) {
  if (showLeftOnMobile) {
    return (
      <main className="min-h-screen bg-[#E4E4E7] p-4 text-neutral-900">
        <div className="mx-auto flex min-h-[calc(100vh-32px)] w-full max-w-[1024px] flex-col overflow-hidden rounded-[16px] bg-white md:flex-row">
          {/* Visual panel */}
          <section className="relative block h-[320px] flex-none overflow-hidden bg-[#09090B] md:h-full md:w-1/2">
            {left}
          </section>

          {/* Form panel */}
          <section className="flex w-full flex-1 flex-col items-center justify-center bg-white md:w-1/2">
            <div className="w-full px-10 py-10 sm:px-12">{right}</div>
          </section>
        </div>
      </main>
    );
  }

  // Keep the previous layout for other auth pages (Forgot/Reset), unless explicitly overridden.
  return (
    <main className="min-h-screen overflow-hidden bg-[#E4E4E7] p-1 text-neutral-900">
      <div className="mx-auto flex min-h-[calc(100vh-8px)] max-w-[1200px] gap-1">
        {/* Visual panel */}
        <section className="relative hidden flex-1 overflow-hidden rounded-[4px] bg-[#09090B] md:block">{left}</section>

        {/* Form panel */}
        <section className="flex w-full items-center justify-center overflow-hidden rounded-[4px] bg-white md:w-[520px]">
          <div className="w-full px-8 py-10 sm:px-10">{right}</div>
        </section>
      </div>
    </main>
  );
}

