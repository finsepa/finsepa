import type { ReactNode } from "react";
import { ProtectedAppShell } from "@/components/layout/protected-app-shell";

export default async function StockLayout({ children }: { children: ReactNode }) {
  return <ProtectedAppShell>{children}</ProtectedAppShell>;
}
