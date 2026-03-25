import type { ReactNode } from "react";

export function AuthSplitLayout({
  left,
  right,
}: {
  left: ReactNode;
  right: ReactNode;
}) {
  return (
    <main className="min-h-screen overflow-hidden bg-[#E4E4E7] p-1 text-neutral-900">
      <div className="mx-auto flex min-h-[calc(100vh-8px)] max-w-[1200px] gap-1">
        {/* Visual panel */}
        <section className="relative hidden flex-1 overflow-hidden rounded-[4px] bg-[#09090B] md:block">
          {left}
        </section>

        {/* Form panel */}
        <section className="flex w-full items-center justify-center overflow-hidden rounded-[4px] bg-white md:w-[520px]">
          <div className="w-full px-8 py-10 sm:px-10">{right}</div>
        </section>
      </div>
    </main>
  );
}

