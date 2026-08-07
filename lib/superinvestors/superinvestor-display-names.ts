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
  blackrock: "BlackRock",
  "baillie-gifford": "Baillie Gifford",
  "renaissance-technologies": "Jim Simons",
  point72: "Steven Cohen",
  "first-eagle": "First Eagle Investments",
  "chris-hohn": "Chris Hohn",
  "jeremy-grantham": "Jeremy Grantham",
  "seth-klarman": "Seth Klarman",
  "carl-icahn": "Carl Icahn",
  "david-tepper": "David Tepper",
  "david-einhorn": "David Einhorn",
  "stanley-druckenmiller": "Stanley Druckenmiller",
  "bill-gates": "Bill Gates",
  "tiger-global": "Chase Coleman",
  "chuck-akre": "Chuck Akre",
  "mohnish-pabrai": "Mohnish Pabrai",
  "tom-gayner": "Tom Gayner",
  "guy-spier": "Guy Spier",
};

export function superinvestorDisplayNameForSlug(slug: string): string {
  const known = SUPERINVESTOR_PROFILE_DISPLAY_NAMES[slug];
  if (known) return known;
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function superinvestorDisplayNameFromProfilePath(
  profilePath: string,
  override?: string | null,
): string {
  const trimmed = override?.trim();
  if (trimmed) return trimmed;

  const slug = profilePath.replace(/^\/superinvestors\//i, "").replace(/\/+$/, "");
  return superinvestorDisplayNameForSlug(slug);
}
