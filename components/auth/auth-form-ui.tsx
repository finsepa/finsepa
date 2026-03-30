import type { InputHTMLAttributes, ReactNode } from "react";

export function AuthTitleBlock({
  title,
  subtitle,
}: {
  title: string;
  subtitle: ReactNode;
}) {
  return (
    <div className="mb-7">
      <h1 className="text-[26px] font-semibold tracking-tight text-[#09090B]">{title}</h1>
      <div className="mt-2 text-sm leading-6 text-[#52525B]">{subtitle}</div>
    </div>
  );
}

export function AuthLabel({ children }: { children: ReactNode }) {
  return <label className="mb-1.5 block text-sm font-medium text-[#09090B]">{children}</label>;
}

export function AuthInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        "h-10 w-full rounded-[10px] border border-[#E4E4E7] bg-[#F4F4F5] px-3 text-sm text-[#09090B]",
        "outline-none transition-colors duration-100",
        "placeholder:text-[#A1A1AA] focus:border-[#D4D4D8] focus:ring-0",
        "disabled:cursor-not-allowed disabled:opacity-60",
        props.className ?? "",
      ].join(" ")}
    />
  );
}

export function AuthPrimaryButton({
  children,
  type = "submit",
  disabled,
  onClick,
}: {
  children: ReactNode;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="flex h-[44px] w-full items-center justify-center rounded-[10px] bg-[#000] px-4 text-sm font-semibold text-white transition-colors duration-100 hover:bg-[#111111] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export function AuthSecondaryButton({
  children,
  type = "button",
}: {
  children: ReactNode;
  type?: "button" | "submit" | "reset";
}) {
  return (
    <button
      type={type}
      className="flex h-10 w-full items-center justify-center gap-2 rounded-[10px] border border-[#E4E4E7] bg-white px-4 text-sm font-semibold text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-all duration-100 hover:bg-[#F4F4F5]"
    >
      {children}
    </button>
  );
}

export function AuthDivider({ label = "or" }: { label?: string }) {
  return (
    <div className="my-6 flex items-center gap-3">
      <div className="h-px flex-1 bg-[#E4E4E7]" />
      <span className="text-xs font-medium uppercase tracking-wide text-[#A1A1AA]">{label}</span>
      <div className="h-px flex-1 bg-[#E4E4E7]" />
    </div>
  );
}

export function AuthMutedLink({
  children,
  href,
}: {
  children: ReactNode;
  href: string;
}) {
  return (
    <a
      href={href}
      className="font-semibold text-[#09090B] underline decoration-[#E4E4E7] underline-offset-4 transition-colors hover:decoration-[#A1A1AA]"
    >
      {children}
    </a>
  );
}

