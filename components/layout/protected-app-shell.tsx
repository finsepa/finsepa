import type { ReactNode } from "react";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PATH_LOGIN } from "@/lib/auth/routes";
import { avatarUrlFromUser, initialsFromUser } from "@/lib/auth/user-display";
import { NavigationTopLoader } from "@/components/layout/navigation-top-loader";
import { PortfolioWorkspaceProvider } from "@/components/portfolio/portfolio-workspace-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
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

  /* Sidebar: p-1 (8px) + 240px = 248px. Topbar strip: top-1 + py-1 + h-[60px] header + py-1 + gap-1 = 76px to main. */
  return (
    <PortfolioWorkspaceProvider userId={user.id}>
      <div className="relative h-dvh max-h-dvh w-full overflow-hidden bg-[rgba(228,228,231,1)]">
        <Suspense fallback={null}>
          <NavigationTopLoader />
        </Suspense>
        <div className="fixed inset-y-0 left-0 z-20 w-[248px] p-1">
          <Sidebar />
        </div>
        <div className="fixed left-[248px] right-1 top-1 z-30 rounded-[4px] bg-white py-1 shadow-[0_1px_0_0_rgba(0,0,0,0.03)]">
          <Topbar userInitials={userInitials} avatarUrl={avatarUrl} />
        </div>
        <main className="fixed bottom-1 left-[248px] right-1 top-[76px] z-0 overflow-y-auto rounded-[4px] bg-white">
          {children}
        </main>
      </div>
    </PortfolioWorkspaceProvider>
  );
}
