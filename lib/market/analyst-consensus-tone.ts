export function normalizeAnalystLabel(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

/** SVG / inline-style hex — matches Target Price tab gauge. */
export function toneForConsensusLabel(label: string): { text: string; dot: string } {
  const l = normalizeAnalystLabel(label);
  if (l === "strong buy") return { text: "#16A34A", dot: "#16A34A" };
  if (l === "buy") return { text: "#84CC16", dot: "#84CC16" };
  if (l === "neutral") return { text: "#CA8A04", dot: "#CA8A04" };
  if (l === "sell") return { text: "#FB923C", dot: "#FB923C" };
  if (l === "strong sell") return { text: "#DC2626", dot: "#DC2626" };
  return { text: "#71717A", dot: "#A1A1AA" };
}

/** Tailwind text color class for Key Stats Analyst Consensus row. */
export function consensusLabelTextClass(label: string): string {
  const l = normalizeAnalystLabel(label);
  if (l === "strong buy") return "text-[#16A34A]";
  if (l === "buy") return "text-[#84CC16]";
  if (l === "neutral") return "text-[#CA8A04]";
  if (l === "sell") return "text-[#FB923C]";
  if (l === "strong sell") return "text-[#DC2626]";
  return "text-[#71717A]";
}
