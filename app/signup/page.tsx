import Link from "next/link";
import { AuthCenteredLayout } from "@/components/auth/auth-centered-layout";
import { SignupClientDynamic } from "./signup-client-dynamic";

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F7F7" },
    { media: "(prefers-color-scheme: dark)", color: "#F7F7F7" },
  ],
};

export default function SignupPage() {
  return (
    <AuthCenteredLayout
      title="Start Your Free Trial"
      subtitle={
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-[#2563EB] underline decoration-[#BFDBFE] underline-offset-4 transition-colors hover:text-[#1D4ED8] hover:decoration-[#93C5FD]"
          >
            Log in
          </Link>
        </>
      }
    >
      <SignupClientDynamic />
    </AuthCenteredLayout>
  );
}
