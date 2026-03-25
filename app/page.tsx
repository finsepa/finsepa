import Link from "next/link";
import { AuthLogo } from "@/components/auth/auth-logo";

const linkClass =
  "font-semibold text-[#09090B] underline decoration-[#E4E4E7] underline-offset-4 transition-colors hover:decoration-[#A1A1AA]";

export default function HomePage() {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-8 px-6 py-16">
      <AuthLogo href="/" />
      <p className="max-w-sm text-center text-sm leading-6 text-[#71717A]">Market intelligence platform</p>
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
        <Link href="/login" className={linkClass}>
          Log in
        </Link>
        <Link href="/signup" className={linkClass}>
          Sign up
        </Link>
      </div>
    </main>
  );
}
