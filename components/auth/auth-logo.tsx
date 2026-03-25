import Link from "next/link";

export function AuthLogo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2">
      <img src="/logo.svg" alt="Finsepa" width={28} height={28} />
      <span className="text-sm font-semibold tracking-tight text-[#09090B]">Finsepa</span>
    </Link>
  );
}

