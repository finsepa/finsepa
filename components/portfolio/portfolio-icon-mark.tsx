"use client";

import { FinsepaLogo } from "@/components/brand/finsepa-logo";
import {
  DEFAULT_PORTFOLIO_ICON_ID,
  type PortfolioIconId,
  isPortfolioIconId,
} from "@/lib/portfolio/portfolio-appearance";
import {
  Briefcase01,
  Building07,
  Coins01,
  Cryptocurrency01,
  FaceSmile,
  GraduationHat01,
  Globe01,
  Heart,
  Home05,
  Hourglass01,
  LineChartUp01,
  PieChart01,
  PiggyBank01,
  Rocket02,
  Safe,
  Scales01,
  ShieldTick,
  Target04,
  Trophy01,
  Umbrella03,
  Users01,
  Wallet01,
  Zap,
} from "@untitledui-pro/icons/solid";
import { cn } from "@/lib/utils";

type MarkProps = {
  iconId?: string | null;
  size?: number;
  className?: string;
};

function resolveIconId(iconId: string | null | undefined): PortfolioIconId {
  return isPortfolioIconId(iconId) ? iconId : DEFAULT_PORTFOLIO_ICON_ID;
}

/** Filled glyph for a portfolio appearance icon (white-on-color tiles use `text-white`). */
export function PortfolioIconMark({ iconId, size = 18, className }: MarkProps) {
  const id = resolveIconId(iconId);
  const common = { size, className: cn("shrink-0", className) } as const;

  switch (id) {
    case "finsepa":
      return <FinsepaLogo size={size} className={cn(className)} title="" />;
    case "briefcase":
      return <Briefcase01 {...common} />;
    case "pie":
      return <PieChart01 {...common} />;
    case "coins":
      return <Coins01 {...common} />;
    case "piggy":
      return <PiggyBank01 {...common} />;
    case "wallet":
      return <Wallet01 {...common} />;
    case "shield":
      return <ShieldTick {...common} />;
    case "umbrella":
      return <Umbrella03 {...common} />;
    case "safe":
      return <Safe {...common} />;
    case "scales":
      return <Scales01 {...common} />;
    case "trendUp":
      return <LineChartUp01 {...common} />;
    case "rocket":
      return <Rocket02 {...common} />;
    case "zap":
      return <Zap {...common} />;
    case "target":
      return <Target04 {...common} />;
    case "trophy":
      return <Trophy01 {...common} />;
    case "hourglass":
      return <Hourglass01 {...common} />;
    case "home":
      return <Home05 {...common} />;
    case "family":
      return <Users01 {...common} />;
    case "child":
      return <FaceSmile {...common} />;
    case "education":
      return <GraduationHat01 {...common} />;
    case "heart":
      return <Heart {...common} />;
    case "globe":
      return <Globe01 {...common} />;
    case "building":
      return <Building07 {...common} />;
    case "crypto":
      return <Cryptocurrency01 {...common} />;
    default:
      return <FinsepaLogo size={size} className={cn(className)} title="" />;
  }
}

/** Human labels for a11y on icon picker buttons. */
export const PORTFOLIO_ICON_LABELS: Record<PortfolioIconId, string> = {
  finsepa: "Finsepa",
  briefcase: "Portfolio",
  pie: "Allocation",
  coins: "Cash",
  piggy: "Retirement",
  wallet: "Wallet",
  shield: "Conservative",
  umbrella: "Protection",
  safe: "Capital preservation",
  scales: "Balanced",
  trendUp: "Growth",
  rocket: "Aggressive",
  zap: "High risk",
  target: "Goal",
  trophy: "Performance",
  hourglass: "Long term",
  home: "Home",
  family: "Family",
  child: "Child",
  education: "Education",
  heart: "Legacy",
  globe: "International",
  building: "Real estate",
  crypto: "Crypto",
};
