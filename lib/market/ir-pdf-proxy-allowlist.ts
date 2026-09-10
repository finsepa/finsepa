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
    (parsed.pathname.includes("/presentation/") ||
      parsed.pathname.includes("/earnings_release/") ||
      parsed.pathname.includes("/klatencor/") ||
      parsed.pathname.includes("/earnings_slide_presentation/"))
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
  if (h === "delltechnologies.com" || h.endsWith(".delltechnologies.com") || h === "delltechnologies.gcs-web.com") {
    return true;
  }
  if (h === "morganstanley.com" || h.endsWith(".morganstanley.com")) return true;
  if (h === "geaerospace.com" || h.endsWith(".geaerospace.com") || h === "ge.com" || h.endsWith(".ge.com")) {
    return true;
  }
  if (h === "pginvestor.com" || h.endsWith(".pginvestor.com")) return true;
  if (h === "homedepot.com" || h.endsWith(".homedepot.com")) return true;
  if (h === "goldmansachs.com" || h.endsWith(".goldmansachs.com") || h === "d3cobg6h0snvt3.cloudfront.net") {
    return true;
  }
  if (
    h === "pmi.com" ||
    h.endsWith(".pmi.com") ||
    h === "philipmorrisinternational.gcs-web.com"
  ) {
    return true;
  }
  if (h === "rbc.com" || h.endsWith(".rbc.com")) return true;
  if (h === "wellsfargo.com" || h.endsWith(".wellsfargo.com")) return true;
  if (h === "shell.com" || h.endsWith(".shell.com")) return true;
  if (h === "alibabagroup.com" || h.endsWith(".alibabagroup.com") || h === "data.alibabagroup.com") {
    return true;
  }
  if (h === "investors.arm.com" || h === "arm.com" || h.endsWith(".arm.com")) return true;
  if (
    h === "investors.paloaltonetworks.com" ||
    h === "paloaltonetworks.com" ||
    h.endsWith(".paloaltonetworks.com")
  ) {
    return true;
  }
  if (h === "investors.rtx.com" || h === "rtx.com" || h.endsWith(".rtx.com") || h === "rtx.gcs-web.com") {
    return true;
  }
  if (h === "novartis.com" || h.endsWith(".novartis.com")) return true;
  if (h === "mufg.jp" || h.endsWith(".mufg.jp")) return true;
  if (h === "investor.sandisk.com" || h === "sandisk.com" || h.endsWith(".sandisk.com")) return true;
  if (h === "nestle.com" || h.endsWith(".nestle.com")) return true;
  if (h === "gevernova.com" || h.endsWith(".gevernova.com")) return true;
  if (h === "astrazeneca.com" || h.endsWith(".astrazeneca.com")) return true;
  if (h === "investors.arista.com" || h === "arista.com" || h.endsWith(".arista.com")) return true;
  if (h === "siemens.com" || h.endsWith(".siemens.com") || h === "assets.new.siemens.com") return true;
  if (h === "sap.com" || h.endsWith(".sap.com")) return true;
  if (h === "lvmh.com" || h.endsWith(".lvmh.com") || h === "lvmh-com.cdn.prismic.io") return true;
  if (h === "loreal-finance.com" || h.endsWith(".loreal-finance.com") || h === "loreal.com" || h.endsWith(".loreal.com")) {
    return true;
  }
  if (h === "ir.kla.com" || h === "kla.com" || h.endsWith(".kla.com")) return true;
  if (h === "investor.ti.com" || h === "ti.com" || h.endsWith(".ti.com")) return true;
  if (h === "group.softbank" || h.endsWith(".softbank")) return true;
  if (h === "bhp.com" || h.endsWith(".bhp.com")) return true;
  if (h === "citigroup.com" || h.endsWith(".citigroup.com")) return true;
  if (h === "global.toyota" || h === "toyota" || h.endsWith(".toyota")) return true;
  if (h === "ibm.com" || h.endsWith(".ibm.com") || h === "www-api.ibm.com") return true;
  if (h === "thermofisher.com" || h.endsWith(".thermofisher.com") || h === "ir.thermofisher.com") return true;
  if (h === "americanexpress.com" || h.endsWith(".americanexpress.com") || h === "ir.americanexpress.com") {
    return true;
  }
  if (h === "linde.com" || h.endsWith(".linde.com")) return true;
  if (h === "santander.com" || h.endsWith(".santander.com")) return true;
  if (h === "ir.crowdstrike.com" || h === "crowdstrike.com" || h.endsWith(".crowdstrike.com")) return true;
  if (h === "investors.amgen.com" || h === "amgen.com" || h.endsWith(".amgen.com")) return true;
  if (h === "netflix.net" || h.endsWith(".netflix.net") || h === "netflix.com" || h.endsWith(".netflix.com")) {
    return true;
  }
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
