import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { PATH_LOGIN } from "@/lib/auth/routes";
import { avatarUrlFromUser, initialsFromUser } from "@/lib/auth/user-display";
import { ProtectedAppShellInner } from "@/components/layout/protected-app-shell-inner";
import { PortfolioWorkspaceProvider } from "@/components/portfolio/portfolio-workspace-provider";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function ProtectedAppShell({ children }: { children: ReactNode }) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(PATH_LOGIN);
  }

  const userInitials = initialsFromUser(user);
  const avatarUrl = avatarUrlFromUser(user);

  /* Sidebar width: 248px expanded / 72px lite (see sidebar-layout-context). Topbar strip → main at 76px. */
  return (
    <PortfolioWorkspaceProvider userId={user.id}>
      <ProtectedAppShellInner userInitials={userInitials} avatarUrl={avatarUrl}>
        {children}
      </ProtectedAppShellInner>
    </PortfolioWorkspaceProvider>
  );
}
