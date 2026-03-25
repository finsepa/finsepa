import { redirect } from "next/navigation";
import { PATH_LOGIN } from "@/lib/auth/routes";
import { displayNameFromUser } from "@/lib/auth/user-display";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-[#A1A1AA]">{label}</dt>
      <dd className="mt-1 text-sm leading-6 text-[#09090B]">{value}</dd>
    </div>
  );
}

export default async function AccountPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(PATH_LOGIN);
  }

  const name = displayNameFromUser(user);
  const created = user.created_at ? new Date(user.created_at).toLocaleDateString() : "—";

  return (
    <div className="px-9 py-6">
      <h1 className="text-2xl font-semibold tracking-tight text-[#09090B]">Account</h1>
      <p className="mt-2 text-sm leading-6 text-[#52525B]">Manage your profile and preferences.</p>

      <dl className="mt-8 max-w-md space-y-5">
        {name ? <Row label="Name" value={name} /> : null}
        <Row label="Email" value={user.email ?? "—"} />
        <Row label="User ID" value={user.id} />
        <Row label="Member since" value={created} />
      </dl>
    </div>
  );
}
