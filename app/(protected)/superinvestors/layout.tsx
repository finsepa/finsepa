import type { ReactNode } from "react";

import { SuperinvestorFollowProvider } from "@/components/superinvestors/superinvestor-follow-provider";

export default function SuperinvestorsLayout({ children }: { children: ReactNode }) {
  return <SuperinvestorFollowProvider>{children}</SuperinvestorFollowProvider>;
}
