"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { PATH_LOGIN } from "@/lib/auth/routes";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { UserAvatar } from "@/components/user/user-avatar";

const POSITION_OPTIONS = [
  "Individual Investor",
  "Financial Advisor",
  "Analyst",
  "Student",
  "Other",
] as const;

export type AccountPageInitial = {
  email: string | null;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  position: string;
  emailNotifications: boolean;
  userInitials: string;
};

const fieldClass =
  "h-10 w-full rounded-[10px] border border-[#E4E4E7] bg-[#F9FAFB] px-3 text-sm text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)] outline-none transition-all duration-100 placeholder:text-[#A1A1AA] focus:border-[#D4D4D8] focus:bg-white focus:shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06),0_0_0_4px_rgba(9,9,11,0.06)]";

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-[#09090B]">
      {children}
    </label>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={id === "current-password" ? "current-password" : "new-password"}
          className={`${fieldClass} pr-11`}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((s) => !s)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[#71717A] transition-colors hover:bg-[#F4F4F5] hover:text-[#09090B]"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export function AccountPageContent({ initial }: { initial: AccountPageInitial }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [email, setEmail] = useState(initial.email ?? "");
  const [position, setPosition] = useState(() => initial.position || "Individual Investor");
  const [emailNotifications, setEmailNotifications] = useState(initial.emailNotifications);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(initial.avatarUrl);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarRemoved, setAvatarRemoved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    setFirstName(initial.firstName);
    setLastName(initial.lastName);
    setEmail(initial.email ?? "");
    setPosition(initial.position || "Individual Investor");
    setEmailNotifications(initial.emailNotifications);
    setAvatarPreview((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return initial.avatarUrl;
    });
    setAvatarFile(null);
    setAvatarRemoved(false);
    if (fileRef.current) fileRef.current.value = "";
  }, [
    initial.firstName,
    initial.lastName,
    initial.email,
    initial.avatarUrl,
    initial.position,
    initial.emailNotifications,
  ]);

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
    setMessage(null);
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
        position,
        email_notifications: emailNotifications,
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

      const payload: { email?: string; data: Record<string, unknown>; password?: string } = {
        data: meta,
      };
      const nextEmail = email.trim();
      if (nextEmail && nextEmail !== (initial.email ?? "")) {
        payload.email = nextEmail;
      }

      const { error: metaErr } = await supabase.auth.updateUser(payload);
      if (metaErr) throw metaErr;

      if (newPassword.trim()) {
        const { error: pwErr } = await supabase.auth.updateUser({ password: newPassword.trim() });
        if (pwErr) throw pwErr;
        setCurrentPassword("");
        setNewPassword("");
      }

      setAvatarFile(null);
      if (fileRef.current) fileRef.current.value = "";
      setMessage({
        type: "ok",
        text: photoNote ?? "Changes saved.",
      });
      router.refresh();
    } catch (e: unknown) {
      const text = e instanceof Error ? e.message : "Something went wrong.";
      setMessage({ type: "err", text });
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

  return (
    <div className="px-9 py-6">
      <div className="mx-auto w-full max-w-3xl">
        <div className="border-b border-[#E4E4E7]">
          <span className="inline-block border-b-2 border-[#09090B] pb-3 text-sm font-semibold text-[#09090B]">
            Profile
          </span>
        </div>

        <div className="mt-8 space-y-10">
        {message ? (
          <p
            className={`text-sm font-medium ${message.type === "ok" ? "text-emerald-600" : "text-red-600"}`}
            role="status"
          >
            {message.text}
          </p>
        ) : null}

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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={fieldClass}
              autoComplete="email"
            />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="acct-position">Describe your position</FieldLabel>
            <div className="relative">
              <select
                id="acct-position"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className={`${fieldClass} appearance-none pr-10`}
              >
                {POSITION_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
                {!POSITION_OPTIONS.includes(position as (typeof POSITION_OPTIONS)[number]) && position ? (
                  <option value={position}>{position}</option>
                ) : null}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#71717A]">▾</span>
            </div>
          </div>
        </section>

        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={emailNotifications}
            onChange={(e) => setEmailNotifications(e.target.checked)}
            className="h-4 w-4 rounded border-[#E4E4E7] text-[#2563EB] focus:ring-[#2563EB]"
          />
          <span className="text-sm font-medium text-[#09090B]">Receive email notifications</span>
        </label>

        <section className="space-y-4">
          <h2 className="text-base font-semibold text-[#09090B]">Security</h2>
          <PasswordField
            id="current-password"
            label="Current password"
            value={currentPassword}
            onChange={setCurrentPassword}
            placeholder="Enter current password"
          />
          <PasswordField
            id="new-password"
            label="New password"
            value={newPassword}
            onChange={setNewPassword}
            placeholder="Enter new password"
          />
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
