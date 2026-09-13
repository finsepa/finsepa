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
      parsed.pathname.includes("/additional_earnings_information/") ||
      parsed.pathname.includes("/financial_tables_pdf/") ||
      parsed.pathname.includes("/klatencor/") ||
      parsed.pathname.includes("/earnings_slide_presentation/") ||
      // Marvell Q4 FY26 deck lives under /file/ on the same CDN hash.
      /\/marvell\/db\/\d+\/\d+\/file\//i.test(parsed.pathname))
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
  // Adobe IR (`www.adobe.com/cc-shared/...` earnings script/slides + press PDFs).
  if (h === "adobe.com" || h.endsWith(".adobe.com")) return true;
  // Verizon IR Drupal file downloads + sites/default/files PDFs.
  if (h === "verizon.com" || h.endsWith(".verizon.com")) {
    if (/\/about\/file\/\d+\/download\/?$/i.test(parsed.pathname) && parsed.searchParams.has("token")) {
      return true;
    }
    if (parsed.pathname.includes("/about/sites/default/files/") && /\.pdf(?:$|[?#])/i.test(parsed.pathname)) {
      return true;
    }
  }
  // TotalEnergies IR results PDFs.
  if (h === "totalenergies.com" || h.endsWith(".totalenergies.com")) return true;
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
  // TD Bank Group quarterly results PDFs under /content/dam/tdcom/.../quarterly-results/.
  if (
    (h === "td.com" || h === "www.td.com" || h.endsWith(".td.com")) &&
    parsed.pathname.includes("/content/dam/tdcom/") &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Charles Schwab IR PDFs on content.schwab.com.
  if (
    (h === "content.schwab.com" || h === "schwab.com" || h.endsWith(".schwab.com")) &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Novo Nordisk IR DAM investor presentations.
  if (
    (h === "novonordisk.com" || h === "www.novonordisk.com" || h.endsWith(".novonordisk.com")) &&
    parsed.pathname.includes("/investors/") &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Analog Devices GCS static-files (Web Schedule + earnings release).
  if (
    h === "investor.analog.com" ||
    h === "analogdevices.gcs-web.com" ||
    (h.endsWith(".analog.com") && /\/static-files\//i.test(parsed.pathname))
  ) {
    return true;
  }
  // Deere IR q4cdn + deere.com news PDFs.
  if (
    (h === "deere.com" || h === "www.deere.com" || h.endsWith(".deere.com")) &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // AT&T IR media earnings packages.
  if (
    (h === "investors.att.com" || h === "att.com" || h.endsWith(".att.com")) &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // McDonald's corporate DAM earnings release PDFs.
  if (
    (h === "corporate.mcdonalds.com" || h === "mcdonalds.com" || h.endsWith(".mcdonalds.com")) &&
    parsed.pathname.includes("/content/dam/") &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Gilead IR q4cdn + investors.gilead.com mirrored PDFs.
  if (
    (h === "investors.gilead.com" || h === "gilead.com" || h.endsWith(".gilead.com")) &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Abbott IR GCS static-files (earnings press releases).
  if (
    h === "www.abbottinvestor.com" ||
    h === "abbottinvestor.com" ||
    (h.endsWith(".abbottinvestor.com") && /\/static-files\//i.test(parsed.pathname))
  ) {
    return true;
  }
  // BlackRock IR PDFs (q4cdn already covered; alias host for completeness).
  if (
    (h === "ir.blackrock.com" || h === "blackrock.com" || h.endsWith(".blackrock.com")) &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // NextEra Energy IR DAM PDFs.
  if (
    (h === "www.investor.nexteraenergy.com" ||
      h === "investor.nexteraenergy.com" ||
      h === "nexteraenergy.com" ||
      h.endsWith(".nexteraenergy.com")) &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
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
  // PepsiCo IR prepared remarks + earnings release PDFs.
  if (h === "investors.pepsico.com" || h === "pepsico.com" || h.endsWith(".pepsico.com")) return true;
  // Intuit IR fact sheets + press PDFs under /_assets/.
  if (h === "investors.intuit.com" || h === "intuit.com" || h.endsWith(".intuit.com")) return true;
  // Qualcomm IR overview hosts files on s204.q4cdn (already allowed via q4cdn).
  if (h === "investor.qualcomm.com" || h === "qualcomm.com" || h.endsWith(".qualcomm.com")) return true;
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
