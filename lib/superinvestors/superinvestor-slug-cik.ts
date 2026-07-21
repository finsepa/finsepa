/**
 * Slug → padded CIK for snapshot keying without SEC round-trips.
 * Kept free of `server-only` so coverage tests can import it.
 */
export const SUPERINVESTOR_SLUG_CIK: Record<string, string> = {
  "berkshire-hathaway": "0001067983",
  "bill-ackman": "0001336528",
  "terry-smith": "0001569205",
  "michael-burry": "0001649339",
  "cathie-wood": "0001697748",
  "li-lu": "0001709323",
  "ray-dalio": "0001350694",
  "ken-fisher": "0000850529",
  "primecap-management": "0000763212",
  "ken-griffin": "0001423053",
  "charlie-munger": "0000783412",
  blackrock: "0002012383",
  "baillie-gifford": "0001088875",
  "renaissance-technologies": "0001037389",
  point72: "0001603466",
  "first-eagle": "0001325447",
  "chris-hohn": "0001647251",
  "jeremy-grantham": "0001352662",
};
