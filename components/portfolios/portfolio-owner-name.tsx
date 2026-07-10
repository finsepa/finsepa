import { VerifiedBadge } from "@/lib/icons";
import { isVerifiedPortfolioOwner } from "@/lib/portfolio/verified-portfolio-owners";
import { cn } from "@/lib/utils";

type Props = {
  name: string;
  className?: string;
};

export function PortfolioOwnerName({ name, className }: Props) {
  const verified = isVerifiedPortfolioOwner(name);

  return (
    <span className={cn("inline-flex min-w-0 max-w-full items-center gap-1", className)}>
      <span className="truncate">{name}</span>
      {verified ? (
        <VerifiedBadge
          size={16}
          color="#1D9BF0"
          className="shrink-0"
          aria-label="Verified"
        />
      ) : null}
    </span>
  );
}
