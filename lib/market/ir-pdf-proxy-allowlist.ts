/**
 * Hosts allowed for streaming through `GET /api/ir-pdf` so PDFs can load in an in-app `<iframe>`
 * (avoids `X-Frame-Options` on some CDNs).
 */
export function isIrPdfProxyUrlAllowed(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  const h = parsed.hostname.toLowerCase();
  if (h === "q4cdn.com" || h.endsWith(".q4cdn.com")) return true;
  if (h === "nvidia.com" || h.endsWith(".nvidia.com")) return true;
  if (h === "nike.com" || h.endsWith(".nike.com")) return true;
  if (h === "apple.com" || h.endsWith(".apple.com")) return true;
  if (h === "cdn.ferrari.com") return true;
  if (h === "cmcsa.com" || h.endsWith(".cmcsa.com")) return true;
  if (h === "micron.com" || h.endsWith(".micron.com")) return true;
  if (h === "lilly.com" || h.endsWith(".lilly.com")) return true;
  if (h === "media.eulerpool.com" && parsed.pathname.startsWith("/presentation/")) return true;
  if (
    h === "d1io3yog0oux5.cloudfront.net" &&
    (parsed.pathname.includes("/presentation/") || parsed.pathname.includes("/earnings_release/"))
  ) {
    return true;
  }
  // ExxonMobil IR 10-Q / 10-K PDFs (2022 archive has decks but no earnings_release PDFs).
  if ((h === "exxonmobil.com" || h.endsWith(".exxonmobil.com")) && /\.pdf(?:$|[?#])/i.test(parsed.pathname)) {
    return true;
  }
  if (h === "coca-colacompany.com" || h.endsWith(".coca-colacompany.com")) return true;
  if (h === "palantir.com" || h.endsWith(".palantir.com")) return true;
  // Walmart IR / newsroom PDFs (opaque `stock.walmart.com/_assets/...` + corporate DAM).
  if (h === "walmart.com" || h.endsWith(".walmart.com")) return true;
  // Mastercard IR alias hosts (canonical files are usually on q4cdn).
  if (h === "mastercard.com" || h.endsWith(".mastercard.com")) return true;
  // AbbVie IR (Q4 / investors.abbvie.com PDFs).
  if (h === "investors.abbvie.com" || h === "abbvie.com" || h.endsWith(".abbvie.com")) return true;
  // JPMorgan Chase IR DAM PDFs.
  if (h === "jpmorganchase.com" || h.endsWith(".jpmorganchase.com")) return true;
  // Tencent IR PDFs (results PPT + earnings releases).
  if (h === "tencent.com" || h.endsWith(".tencent.com") || h === "static.www.tencent.com") return true;
  // UnitedHealth Group IR DAM PDFs (earnings releases / 10-Q; decks are usually SEC HTML).
  if (h === "unitedhealthgroup.com" || h.endsWith(".unitedhealthgroup.com")) return true;
  // Merck IR wp-content earnings presentations.
  if (h === "merck.com" || h.endsWith(".merck.com")) return true;
  // Applied Materials GCS static-files decks.
  if (h === "appliedmaterials.com" || h.endsWith(".appliedmaterials.com")) return true;
  // Lam Research investorroom filecache PDFs.
  if (h === "filecache.investorroom.com" || h.endsWith(".investorroom.com")) return true;
  if (h === "lamresearch.com" || h.endsWith(".lamresearch.com")) return true;
  if (h === "costco.com" || h.endsWith(".costco.com")) return true;
  if (h === "chevron.com" || h.endsWith(".chevron.com") || h === "chevroncorp.gcs-web.com") return true;
  if (h === "caterpillar.com" || h.endsWith(".caterpillar.com")) return true;
  if (h === "hsbc.com" || h.endsWith(".hsbc.com")) return true;
  // Tesla Cloudinary + assets-ir Update PDFs.
  if (h === "digitalassets.tesla.com" || h === "assets-ir.tesla.com") return true;
  // Broadcom IR press-release PDFs (`/node/N/pdf` and static-files).
  if (h === "investors.broadcom.com" || h === "broadcom.gcs-web.com") return true;
  // ASML IR DAM / media PDFs.
  if (h === "ourbrand.asml.com" || h === "media.asml.com" || h === "asml.com" || h.endsWith(".asml.com")) {
    return true;
  }
  // TSMC IR encrypt_file PDFs (Presentation / EarningsRelease / ManagementReport / FS).
  if (h === "investor.tsmc.com" || h === "tsmc.com" || h.endsWith(".tsmc.com")) return true;
  // Cisco IR q4cdn PDFs.
  if (h === "investor.cisco.com" || h === "cisco.com" || h.endsWith(".cisco.com")) return true;
  // Amazon IR-hosted Form 10-Q / 10-K PDFs (SEC Forms column on ir.aboutamazon.com).
  if (h === "d18rn0p25nwr6d.cloudfront.net" && /\/CIK-\d+\//i.test(parsed.pathname) && /\.pdf$/i.test(parsed.pathname)) {
    return true;
  }
  // Finsepa-hosted IR mirrors (Quartr-style): Supabase public bucket `earnings-ir-docs`.
  if (
    (h.endsWith(".supabase.co") || h.includes("supabase")) &&
    parsed.pathname.includes("/storage/v1/object/public/earnings-ir-docs/") &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  if (h === "www.sec.gov" || h === "sec.gov") {
    const p = parsed.pathname.toLowerCase();
    return p.includes("/archives/edgar/") && p.endsWith(".pdf");
  }
  return false;
}
