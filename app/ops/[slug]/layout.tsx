import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ops",
  robots: { index: false, follow: false },
};

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-canvas text-fg">{children}</div>;
}
