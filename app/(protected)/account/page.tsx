import { redirect } from "next/navigation";
import { AccountPageContent } from "@/components/account/account-page-content";
import { PATH_LOGIN } from "@/lib/auth/routes";
import { avatarUrlFromUser, initialsFromUser } from "@/lib/auth/user-display";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export default async function AccountPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(PATH_LOGIN);
  }

  const m = (user.user_metadata ?? {}) as Record<string, unknown>;
  const firstName = typeof m.first_name === "string" ? m.first_name : "";
  const lastName = typeof m.last_name === "string" ? m.last_name : "";
  const avatarUrl = avatarUrlFromUser(user);
  const position = typeof m.position === "string" ? m.position : "Individual Investor";
  const emailNotifications = m.email_notifications === false ? false : true;

  return (
    <AccountPageContent
      initial={{
        email: user.email ?? null,
        firstName,
        lastName,
        avatarUrl,
        position,
        emailNotifications,
        userInitials: initialsFromUser(user),
      }}
    />
  );
}
