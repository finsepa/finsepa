/** Client-safe slug → display name (keep in sync with `SUPERINVESTOR_REGISTRY`). */
const SUPERINVESTOR_PROFILE_DISPLAY_NAMES: Record<string, string> = {
  "berkshire-hathaway": "Warren Buffett",
  "bill-ackman": "Bill Ackman",
  "terry-smith": "Terry Smith",
  "michael-burry": "Michael Burry",
  "cathie-wood": "Cathie Wood",
  "li-lu": "Li Lu",
  "ray-dalio": "Ray Dalio",
  "ken-fisher": "Ken Fisher",
  "primecap-management": "PRIMECAP Management",
  "ken-griffin": "Ken Griffin",
  "charlie-munger": "Charlie Munger",
  "blackrock": "BlackRock",
  "baillie-gifford": "Baillie Gifford",
  "renaissance-technologies": "Jim Simons",
  point72: "Steven Cohen",
  "first-eagle": "First Eagle Investments",
  "chris-hohn": "Chris Hohn",
  "jeremy-grantham": "Jeremy Grantham",
};

export function superinvestorDisplayNameFromProfilePath(
  profilePath: string,
  override?: string | null,
): string {
  const trimmed = override?.trim();
  if (trimmed) return trimmed;

  const slug = profilePath.replace(/^\/superinvestors\//i, "").replace(/\/+$/, "");
  const known = SUPERINVESTOR_PROFILE_DISPLAY_NAMES[slug];
  if (known) return known;

  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
