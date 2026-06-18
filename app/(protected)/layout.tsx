import type { ReactNode } from "react";

import { ProtectedAppShell } from "@/components/layout/protected-app-shell";

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return <ProtectedAppShell>{children}</ProtectedAppShell>;
}
