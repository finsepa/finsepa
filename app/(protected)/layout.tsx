import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { PATH_LOGIN } from "@/lib/auth/routes";
import { initialsFromUser } from "@/lib/auth/user-display";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(PATH_LOGIN);
  }

  const userInitials = initialsFromUser(user);

  return (
    <div className="flex min-h-full bg-white">
      <Sidebar />
      <div className="flex min-h-full min-w-0 flex-1 flex-col border-l border-[#E4E4E7]">
        <Topbar userInitials={userInitials} />
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
