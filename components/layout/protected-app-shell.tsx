import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { PATH_LOGIN } from "@/lib/auth/routes";
import { avatarUrlFromUser, displayNameFromUser, initialsFromUser } from "@/lib/auth/user-display";
import { ProtectedAppShellInner } from "@/components/layout/protected-app-shell-inner";
import { PortfolioWorkspaceProvider } from "@/components/portfolio/portfolio-workspace-provider";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function ProtectedAppShell({ children }: { children: ReactNode }) {
  let user: User | null = null;
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user: u },
    } = await supabase.auth.getUser();
    user = u;
  } catch {
    redirect(PATH_LOGIN);
  }

  if (!user) {
    redirect(PATH_LOGIN);
  }

  const userInitials = initialsFromUser(user);
  const avatarUrl = avatarUrlFromUser(user);
  const listingOwnerDisplayName = displayNameFromUser(user) ?? user.email?.split("@")[0] ?? "Member";

  /* Sidebar width: 248px expanded / 72px lite (see sidebar-layout-context). Topbar strip → main at 76px. */
  return (
    <PortfolioWorkspaceProvider
      userId={user.id}
      listingOwnerDisplayName={listingOwnerDisplayName}
      listingOwnerAvatarUrl={avatarUrl}
    >
      <ProtectedAppShellInner userInitials={userInitials} avatarUrl={avatarUrl}>
        {children}
      </ProtectedAppShellInner>
    </PortfolioWorkspaceProvider>
  );
}
