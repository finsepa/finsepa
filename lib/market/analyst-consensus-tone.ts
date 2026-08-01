import { resolveFsColor } from "@/lib/theme/resolve-fs-color";

export function normalizeAnalystLabel(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

/** SVG / inline-style hex — matches Target Price tab gauge; theme-aware via CSS vars. */
export function toneForConsensusLabel(label: string): { text: string; dot: string } {
  const l = normalizeAnalystLabel(label);
  if (l === "strong buy") {
    const c = resolveFsColor("--fs-up");
    return { text: c, dot: c };
  }
  if (l === "buy") return { text: "#84CC16", dot: "#84CC16" };
  if (l === "neutral") {
    const c = resolveFsColor("--fs-orange");
    return { text: c, dot: c };
  }
  if (l === "sell") return { text: "#FB923C", dot: "#FB923C" };
  if (l === "strong sell") {
    const c = resolveFsColor("--fs-down");
    return { text: c, dot: c };
  }
  const muted = resolveFsColor("--fs-fg-muted");
  return { text: muted, dot: resolveFsColor("--fs-fg-subtle") };
}

/** Tailwind text color class for Key Stats Analyst Consensus row. */
export function consensusLabelTextClass(label: string): string {
  const l = normalizeAnalystLabel(label);
  if (l === "strong buy") return "text-up";
  if (l === "buy") return "text-[#84CC16]";
  if (l === "neutral") return "text-orange";
  if (l === "sell") return "text-[#FB923C]";
  if (l === "strong sell") return "text-down";
  return "text-fg-muted";
}
