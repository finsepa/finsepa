"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PATH_LOGIN } from "@/lib/auth/routes";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { UserAvatar } from "@/components/user/user-avatar";

export type AccountPageInitial = {
  email: string | null;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  userInitials: string;
};

const fieldClass =
  "h-10 w-full rounded-[10px] border border-[#E4E4E7] bg-[#F9FAFB] px-3 text-sm text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)] outline-none transition-all duration-100 placeholder:text-[#A1A1AA] focus:border-[#D4D4D8] focus:bg-white focus:shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06),0_0_0_4px_rgba(9,9,11,0.06)]";

const readOnlyFieldClass =
  "h-10 w-full cursor-default rounded-[10px] border border-[#E4E4E7] bg-[#F4F4F5] px-3 text-sm text-[#71717A] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)] outline-none";

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-[#09090B]">
      {children}
    </label>
  );
}

export function AccountPageContent({ initial }: { initial: AccountPageInitial }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(initial.avatarUrl);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarRemoved, setAvatarRemoved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    setFirstName(initial.firstName);
    setLastName(initial.lastName);
    setAvatarPreview((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return initial.avatarUrl;
    });
    setAvatarFile(null);
    setAvatarRemoved(false);
    if (fileRef.current) fileRef.current.value = "";
  }, [initial.firstName, initial.lastName, initial.avatarUrl]);

  useEffect(() => {
    return () => {
      if (avatarPreview && avatarPreview.startsWith("blob:")) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  function onPickFile(f: File | null) {
    if (!f || !f.type.startsWith("image/")) return;
    setAvatarFile(f);
    setAvatarRemoved(false);
    setAvatarPreview((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
  }

  function onRemoveAvatar() {
    setAvatarFile(null);
    setAvatarRemoved(true);
    setAvatarPreview((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSave() {
    setSaving(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in.");

      const meta: Record<string, unknown> = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      };

      let photoNote: string | null = null;
      if (avatarRemoved) {
        meta.avatar_url = null;
      } else if (avatarFile) {
        const ext = avatarFile.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "jpg";
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("avatars").upload(path, avatarFile, {
          upsert: true,
        });
        if (!upErr) {
          const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
          meta.avatar_url = pub.publicUrl;
        } else {
          photoNote =
            "Profile saved, but the photo could not be uploaded (create a public “avatars” bucket in Supabase Storage).";
        }
      }

      const { error: metaErr } = await supabase.auth.updateUser({ data: meta });
      if (metaErr) throw metaErr;

      setAvatarFile(null);
      if (fileRef.current) fileRef.current.value = "";
      if (photoNote) {
        toast.warning("Profile saved", { description: photoNote });
      } else {
        toast.success("Changes saved.");
      }
      router.refresh();
    } catch (e: unknown) {
      const text = e instanceof Error ? e.message : "Something went wrong.";
      toast.error(text);
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
      router.refresh();
      router.push(PATH_LOGIN);
    } finally {
      setSigningOut(false);
    }
  }

  const displayEmail = initial.email ?? "";

  return (
    <div className="min-w-0 px-4 py-4 sm:px-9 sm:py-6">
      <div className="mx-auto w-full max-w-3xl">
        <div className="border-b border-[#E4E4E7]">
          <span className="inline-block border-b-2 border-[#09090B] pb-3 text-sm font-semibold text-[#09090B]">
            Profile
          </span>
        </div>

        <div className="mt-8 space-y-10">
          <section>
            <FieldLabel>Profile picture</FieldLabel>
            <div className="mt-2 flex flex-wrap items-center gap-4">
              <UserAvatar imageSrc={avatarPreview} initials={initial.userInitials} size="lg" />
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="h-10 rounded-[10px] bg-[#09090B] px-4 text-sm font-semibold text-white shadow-[0px_1px_2px_0px_rgba(10,10,10,0.12)] transition-colors hover:bg-[#18181B]"
                >
                  Upload Image
                </button>
                <button
                  type="button"
                  onClick={onRemoveAvatar}
                  className="h-10 rounded-[10px] border border-[#E4E4E7] bg-white px-4 text-sm font-semibold text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-colors hover:bg-[#F4F4F5]"
                >
                  Remove
                </button>
              </div>
            </div>
          </section>

          <section className="grid gap-5 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="acct-first">First name</FieldLabel>
              <input
                id="acct-first"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={fieldClass}
                autoComplete="given-name"
              />
            </div>
            <div>
              <FieldLabel htmlFor="acct-last">Last name</FieldLabel>
              <input
                id="acct-last"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={fieldClass}
                autoComplete="family-name"
              />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="acct-email">Email</FieldLabel>
              <input
                id="acct-email"
                type="email"
                value={displayEmail}
                readOnly
                aria-readonly="true"
                className={readOnlyFieldClass}
                autoComplete="email"
              />
            </div>
          </section>

          <div className="flex flex-col-reverse gap-3 border-t border-[#E4E4E7] pt-8 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              disabled={signingOut}
              onClick={() => void handleSignOut()}
              className="h-10 w-full rounded-[10px] border border-[#E4E4E7] bg-white px-4 text-sm font-semibold text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-colors hover:bg-[#F4F4F5] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {signingOut ? "Logging out…" : "Log Out"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="h-10 w-full rounded-[10px] bg-[#2563EB] px-6 text-sm font-semibold text-white shadow-[0px_1px_2px_0px_rgba(37,99,235,0.25)] transition-colors hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
