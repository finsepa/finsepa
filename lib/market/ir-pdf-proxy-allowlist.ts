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
      parsed.pathname.includes("/prologis/") ||
      // Parker-Hannifin earnings decks + press PDFs.
      /\/parker\/(?:db\/\d+\/\d+\/(?:pdf|presentation|file)\/|news\/)/i.test(parsed.pathname) ||
      // PNC earnings slides + release (+ Q4'22 /news/ press PDF).
      /\/pnc\/(?:db\/\d+\/\d+\/(?:presentation|earnings_release)\/|news\/)/i.test(parsed.pathname) ||
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
  // Rio Tinto IR results PDFs (Sitecore media + CDN mirror).
  if (
    (h === "www.riotinto.com" ||
      h === "riotinto.com" ||
      h.endsWith(".riotinto.com") ||
      h === "cdn-rio.dataweavers.io") &&
    parsed.pathname.includes("/-/media/") &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Welltower IR Business Update + Earnings Release PDFs.
  if (
    (h === "welltower.com" || h === "www.welltower.com" || h.endsWith(".welltower.com")) &&
    parsed.pathname.includes("/wp-content/uploads/") &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Union Pacific IR GCS static-files (Presentation + News Release).
  if (
    h === "investor.unionpacific.com" ||
    h === "unionpacific.gcs-web.com" ||
    (h.endsWith(".unionpacific.com") && /\/static-files\//i.test(parsed.pathname))
  ) {
    return true;
  }
  // SMFG English IR results + investor meeting PDFs.
  if (h === "smfg.co.jp" || h === "www.smfg.co.jp" || h.endsWith(".smfg.co.jp")) return true;
  // Sony Group IR earnings presentation + financial statements.
  if (
    (h === "www.sony.com" || h === "sony.com" || h.endsWith(".sony.com")) &&
    parsed.pathname.includes("/SonyInfo/IR/library/presen/er/pdf/") &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Danaher IR Earnings Presentation + press `?asPDF` (+ InvestorRoom filecache redirect).
  if (
    (h === "investors.danaher.com" || h.endsWith(".danaher.com")) &&
    ((parsed.pathname.includes("/image/") && /\.pdf(?:$|[?#])/i.test(parsed.pathname)) ||
      (parsed.searchParams.has("asPDF") && /danaher-reports/i.test(parsed.pathname)))
  ) {
    return true;
  }
  if (
    h === "filecache.investorroom.com" &&
    parsed.pathname.includes("/mr5ir_danaher/") &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Western Digital IR GCS static-files (Presentation + Press Release).
  if (
    h === "investor.wdc.com" ||
    h === "wdc.gcs-web.com" ||
    (h.endsWith(".wdc.com") && /\/static-files\//i.test(parsed.pathname))
  ) {
    return true;
  }
  // UBS IR quarterly results + media-release PDFs (quarterlies DAM and /content/dam/assets/news/).
  if (
    (h === "ubs.com" || h === "www.ubs.com" || h.endsWith(".ubs.com")) &&
    parsed.pathname.includes("/content/dam/") &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname) &&
    (parsed.pathname.includes("/investor-relations/quarterlies/") ||
      parsed.pathname.includes("/assets/news/") ||
      parsed.pathname.includes("/assets/cc/investor-relations/") ||
      /results-presentation|media-release|mr-results-/i.test(parsed.pathname))
  ) {
    return true;
  }
  // ConocoPhillips earnings release + deck PDFs.
  if (
    (h === "static.conocophillips.com" ||
      h === "www.conocophillips.com" ||
      h.endsWith(".conocophillips.com")) &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Boeing IR q4cdn presentations + press releases.
  if (h === "s2.q4cdn.com" && parsed.pathname.includes("/661678649/") && /\.pdf(?:$|[?#])/i.test(parsed.pathname)) {
    return true;
  }
  // Shopify IR GCS static-files.
  if (
    h === "shopifyinvestors.gcs-web.com" ||
    (h === "investors.shopify.com" && /\/static-files\//i.test(parsed.pathname))
  ) {
    return true;
  }
  // Southern Copper IR presentation + press PDFs.
  if (
    (h === "southerncoppercorp.com" ||
      h === "www.southerncoppercorp.com" ||
      h.endsWith(".southerncoppercorp.com")) &&
    parsed.pathname.includes("/wp-content/uploads/") &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // BBVA shareholders IR wp-content Results Presentation + Informe PDFs.
  if (
    (h === "shareholdersandinvestors.bbva.com" || h === "bbva.com" || h.endsWith(".bbva.com")) &&
    parsed.pathname.includes("/wp-content/uploads/") &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // AB InBev IR assets + Builder CDN Results Center PDFs (no `.pdf` suffix).
  if (
    (h === "www.ab-inbev.com" || h === "ab-inbev.com" || h.endsWith(".ab-inbev.com")) &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  if (
    h === "cdn.builder.io" &&
    (parsed.pathname.includes("assets%2F2e5c7fb020194c1a8ee80f743d0b923e%2F") ||
      decodeURIComponent(parsed.pathname).includes("/assets/2e5c7fb020194c1a8ee80f743d0b923e/")) &&
    parsed.searchParams.get("alt") === "media"
  ) {
    return true;
  }
  // Interactive Brokers IR getFileNew.php PDFs (`file=YYYYQn_*.pdf`).
  if (
    (h === "ndcdyn.interactivebrokers.com" || h.endsWith(".interactivebrokers.com")) &&
    /\/mkt\/getFileNew\.php$/i.test(parsed.pathname) &&
    /\.pdf$/i.test(parsed.searchParams.get("file") ?? "")
  ) {
    return true;
  }
  // Eaton IR analyst presentation + earnings-complete PDFs.
  if (
    (h === "www.eaton.com" || h === "eaton.com" || h.endsWith(".eaton.com")) &&
    parsed.pathname.includes("/investor-relations/quarterly-earnings/") &&
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
  // Newmont IR earnings PDFs (s24.q4cdn.com/382246808).
  if (h === "s24.q4cdn.com" && parsed.pathname.includes("/382246808/") && /\.pdf(?:$|[?#])/i.test(parsed.pathname)) {
    return true;
  }
  // Bristol Myers Squibb IR PDFs (www.bms.com + s21.q4cdn.com/104148044).
  if (h === "bms.com" || h.endsWith(".bms.com")) return true;
  if (h === "s21.q4cdn.com" && parsed.pathname.includes("/104148044/") && /\.pdf(?:$|[?#])/i.test(parsed.pathname)) {
    return true;
  }
  // Corning IR earnings PDFs (s203.q4cdn.com/212458750).
  if (h === "s203.q4cdn.com" && parsed.pathname.includes("/212458750/") && /\.pdf(?:$|[?#])/i.test(parsed.pathname)) {
    return true;
  }
  // Chubb IR press releases (s201.q4cdn.com/471466897).
  if (h === "s201.q4cdn.com" && parsed.pathname.includes("/471466897/") && /\.pdf(?:$|[?#])/i.test(parsed.pathname)) {
    return true;
  }
  // Vertex IR GCS static-files presentations.
  if (
    h === "investors.vrtx.com" ||
    (h.endsWith(".vrtx.com") && /\/static-files\//i.test(parsed.pathname))
  ) {
    return true;
  }
  // Intuitive Surgical IR GCS static-files presentations + `/node/N/pdf` press.
  if (
    h === "isrg.intuitive.com" ||
    h === "isrg.gcs-web.com" ||
    (h.endsWith(".intuitive.com") &&
      (/\/static-files\//i.test(parsed.pathname) || /\/node\/\d+\/pdf\/?$/i.test(parsed.pathname)))
  ) {
    return true;
  }
  // Unilever IR results PDFs under /files/.
  if ((h === "unilever.com" || h === "www.unilever.com" || h.endsWith(".unilever.com")) && /\.pdf(?:$|[?#])/i.test(parsed.pathname)) {
    return true;
  }
  // TJX IR earnings press release PDFs (docs DAM + investor.tjx.com static-files).
  if (
    h === "investor.tjx.com" ||
    h === "tjx.com" ||
    h === "www.tjx.com" ||
    (h.endsWith(".tjx.com") &&
      (/\/static-files\//i.test(parsed.pathname) ||
        /\/docs\/default-source\/investor-docs\//i.test(parsed.pathname)))
  ) {
    return true;
  }
  // Cloudflare IR earnings PDFs (cloudflare.net/files).
  if (
    (h === "cloudflare.net" || h.endsWith(".cloudflare.net")) &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Progressive IR PDFs (s202.q4cdn.com/605347829).
  if (h === "s202.q4cdn.com" && parsed.pathname.includes("/605347829/") && /\.pdf(?:$|[?#])/i.test(parsed.pathname)) {
    return true;
  }
  // Mizuho FG IR PDFs (library.mizuhogroup.com + Webflow CDN).
  if (
    h === "library.mizuhogroup.com" ||
    (h === "cdn.prod.website-files.com" &&
      parsed.pathname.includes("/67cb23eaf0c6c4d4080e059a/") &&
      /\.pdf(?:$|[?#])/i.test(parsed.pathname)) ||
    ((h === "www.mizuhogroup.com" || h.endsWith(".mizuhogroup.com")) && /\.pdf(?:$|[?#])/i.test(parsed.pathname))
  ) {
    return true;
  }
  // Fast Retailing IR library PDFs.
  if (
    (h === "www.fastretailing.com" || h === "fastretailing.com" || h.endsWith(".fastretailing.com")) &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // BNP Paribas IR document PDFs (no .pdf suffix).
  if (
    (h === "invest.bnpparibas" || h.endsWith(".bnpparibas")) &&
    /\/en\/document\/\dq\d{2}-(slides|pr)\/?$/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Progressive Complete Earnings Release (GlobeNewswire Resource/Download).
  if (
    (h === "ml.globenewswire.com" || h.endsWith(".globenewswire.com")) &&
    /\/Resource\/Download\/[a-f0-9-]{36}\/?$/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Bank of Montreal IR quarter packs.
  if (
    (h === "www.bmo.com" || h === "bmo.com" || h.endsWith(".bmo.com")) &&
    parsed.pathname.includes("/ir/qtrinfo/") &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Richemont IR media PDFs.
  if (
    (h === "www.richemont.com" || h === "richemont.com" || h.endsWith(".richemont.com")) &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // BAT results-centre DAM PDFs.
  if ((h === "www.bat.com" || h === "bat.com" || h.endsWith(".bat.com")) && /\.pdf(?:$|[?#])/i.test(parsed.pathname)) {
    return true;
  }
  // Fortinet IR GCS static-files.
  if (
    h === "investor.fortinet.com" ||
    h === "fortinet.gcs-web.com" ||
    (h.endsWith(".fortinet.com") && /\/static-files\//i.test(parsed.pathname))
  ) {
    return true;
  }
  // Lockheed Martin MediaRoom + IR static-files.
  if (
    (h === "filecache.mediaroom.com" &&
      /\/mr5mr_lockheedmartin\//i.test(parsed.pathname) &&
      /\.pdf(?:$|[?#])/i.test(parsed.pathname)) ||
    ((h === "investors.lockheedmartin.com" || h.endsWith(".lockheedmartin.com")) &&
      /\/static-files\//i.test(parsed.pathname))
  ) {
    return true;
  }
  // Tokyo Electron IR earnings PDFs (www.tel.com).
  if (
    (h === "www.tel.com" || h === "tel.com" || h.endsWith(".tel.com")) &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Air Liquide IR earnings PDFs (www.airliquide.com/sites/.../files/).
  if (
    (h === "www.airliquide.com" || h === "airliquide.com" || h.endsWith(".airliquide.com")) &&
    parsed.pathname.includes("/sites/") &&
    parsed.pathname.includes("/files/") &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // HDFC Bank IR earnings PDFs (www.hdfc.bank.in / hdfcbank.com DAM).
  if (
    (h === "www.hdfc.bank.in" ||
      h === "hdfc.bank.in" ||
      h === "www.hdfcbank.com" ||
      h.endsWith(".hdfcbank.com")) &&
    parsed.pathname.includes("/content/dam/") &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Medtronic IR earnings PDFs.
  if (
    (h === "investorrelations.medtronic.com" || h.endsWith(".medtronic.com")) &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Mitsubishi Corporation IR English PDFs.
  if (
    (h === "www.mitsubishicorp.com" || h.endsWith(".mitsubishicorp.com")) &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Zijin Mining English results PDFs.
  if (
    (h === "www.zijinmining.com" ||
      h === "zijinmining.com" ||
      h.endsWith(".zijinmining.com") ||
      h === "www.zjky.cn" ||
      h.endsWith(".zjky.cn")) &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Scotiabank quarterly-reports IR PDFs.
  if (
    (h === "www.scotiabank.com" || h === "scotiabank.com" || h.endsWith(".scotiabank.com")) &&
    parsed.pathname.includes("/corporate/quarterly-reports/") &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Altria Sitecore CDN + www.altria.com media + q4cdn (505541855) earnings PDFs.
  if (
    (h === "edge.sitecorecloud.io" || h.endsWith(".sitecorecloud.io")) &&
    parsed.pathname.includes("/Project/Altria/") &&
    (/\.pdf(?:$|[?#])/i.test(parsed.pathname) || /\.pdf(?:$|[?#])/i.test(url))
  ) {
    return true;
  }
  if (
    ((h === "www.altria.com" || h === "altria.com" || h.endsWith(".altria.com")) &&
      /\.pdf(?:$|[?#])/i.test(parsed.pathname)) ||
    ((h === "s204.q4cdn.com" || h.endsWith(".q4cdn.com")) &&
      parsed.pathname.includes("/505541855/") &&
      /\.pdf(?:$|[?#])/i.test(parsed.pathname))
  ) {
    return true;
  }
  // Accenture IR media PDFs (accenture-v4 + Accenture-IR-V3).
  if (
    (h === "investor.accenture.com" || h.endsWith(".accenture.com")) &&
    parsed.pathname.includes("/media/Files/A/") &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // PDD Holdings GCS static-files earnings releases.
  if (
    (h === "investor.pddholdings.com" || h.endsWith(".pddholdings.com")) &&
    (/\/static-files\/[a-f0-9-]{36}/i.test(parsed.pathname) ||
      /\/node\/\d+\/pdf\/?$/i.test(parsed.pathname) ||
      /\.pdf(?:$|[?#])/i.test(parsed.pathname))
  ) {
    return true;
  }
  // BP IR Contentful file API PDFs.
  if (
    (h === "www.bp.com" || h === "bp.com" || h.endsWith(".bp.com")) &&
    parsed.pathname.includes("/api/files/") &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // OCBC (OVCHY) iwov-resources quarterly PDFs.
  if (
    (h === "www.ocbc.com" || h === "ocbc.com" || h.endsWith(".ocbc.com")) &&
    parsed.pathname.includes("/iwov-resources/") &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Zurich Insurance media-assets IR PDFs.
  if (
    (h === "www.zurich.com" || h === "zurich.com" || h.endsWith(".zurich.com")) &&
    parsed.pathname.includes("/media-assets/") &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // ASE Technology Holding (ASX) TodayIR media PDFs.
  if (
    (h === "media-aseholdco.todayir.com" || h.endsWith(".todayir.com")) &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Starbucks IR q4cdn (326826266) Earnings at a Glance + Earnings Release.
  if (
    (h === "s203.q4cdn.com" || h.endsWith(".q4cdn.com")) &&
    parsed.pathname.includes("/326826266/") &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Robinhood IR GCS static-files (presentation + press; no .pdf suffix).
  if (
    (h === "investors.robinhood.com" || h.endsWith(".robinhood.com")) &&
    /\/static-files\/[a-f0-9-]{36}/i.test(parsed.pathname)
  ) {
    return true;
  }
  // CME Group IR Drupal static-files (Quarterly Earnings Commentary + Earnings Press Release).
  if (
    (h === "investor.cmegroup.com" || h.endsWith(".cmegroup.com")) &&
    /\/static-files\/[a-f0-9-]{36}/i.test(parsed.pathname)
  ) {
    return true;
  }
  // BYD (BYDDY) HKEX listedco results announcements (filings-only; no decks on bydglobal SPA).
  if (
    (h === "www1.hkexnews.hk" || h.endsWith(".hkexnews.hk")) &&
    parsed.pathname.includes("/listedco/listconews/") &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Mitsui (MITSY) IR Meeting presentations + flash reports.
  if (
    (h === "www.mitsui.com" || h.endsWith(".mitsui.com")) &&
    parsed.pathname.includes("/ir/library/meeting/") &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Itaú (ITUB) MZ IQ filemanager PDFs (no .pdf suffix).
  if (
    (h === "api.mziq.com" || h.endsWith(".mziq.com")) &&
    /\/mzfilemanager\/v2\/d\/42787847-4cf6-4461-94a5-40ed237dca33\/[a-f0-9-]{36}/i.test(parsed.pathname)
  ) {
    return true;
  }
  // KKR IR EQS document library (Investor Presentation + Earnings Release).
  if (
    (h === "ir.kkr.com" || h.endsWith(".kkr.com")) &&
    parsed.pathname.includes("/media/document/") &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Midea (MGCLY) AEM content/dam financial reports + snapshots.
  if (
    (h === "www.midea.com.cn" || h.endsWith(".midea.com.cn")) &&
    parsed.pathname.includes("/content/dam/") &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Postal Savings Bank of China (PSTVY) IR presentations + financial reports.
  if (
    (h === "www.psbc.com" || h.endsWith(".psbc.com")) &&
    parsed.pathname.includes("/investor_relations/") &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // AXA (AXAHY) Prismic CDN results presentations + press.
  if (
    (h === "www-axa-com.cdn.prismic.io" || h.endsWith(".prismic.io")) &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Lowe's IR Drupal files (infographic slides + earnings/press release).
  if (
    (h === "corporate.lowes.com" || h.endsWith(".lowes.com")) &&
    parsed.pathname.includes("/sites/lowes-corp/files/") &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // ADP IR q4cdn (887941133) Earnings Deck/Presentation + Earnings Release.
  if (
    (h === "s205.q4cdn.com" || h.endsWith(".q4cdn.com")) &&
    parsed.pathname.includes("/887941133/") &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Spotify IR q4cdn (175625835) Shareholder Deck / Letter.
  if (
    (h === "s29.q4cdn.com" || h.endsWith(".q4cdn.com")) &&
    parsed.pathname.includes("/175625835/") &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // CIBC (CM) quarterly-results presentation + news release.
  if (
    (h === "www.cibc.com" || h.endsWith(".cibc.com")) &&
    parsed.pathname.includes("/quarterly-results/") &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Stryker IR q4cdn (857738142) earnings press releases.
  if (
    (h === "s22.q4cdn.com" || h.endsWith(".q4cdn.com")) &&
    parsed.pathname.includes("/857738142/") &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Enbridge IR media earnings presentations.
  if (
    (h === "www.enbridge.com" || h.endsWith(".enbridge.com")) &&
    (parsed.pathname.includes("/Investor-Relations/") || parsed.pathname.includes("/investor-relations/")) &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Phillips 66 IR q4cdn (128149789) presentation + earnings release.
  if (
    (h === "s22.q4cdn.com" || h.endsWith(".q4cdn.com")) &&
    parsed.pathname.includes("/128149789/") &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Freeport-McMoRan IR q4cdn (529358580) presentations + earnings releases.
  if (
    (h === "s22.q4cdn.com" || h.endsWith(".q4cdn.com")) &&
    parsed.pathname.includes("/529358580/") &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Itochu (ITOCY) English financial_statements PDFs.
  if (
    (h === "www.itochu.co.jp" || h.endsWith(".itochu.co.jp")) &&
    (parsed.pathname.includes("/financial_statements/") || parsed.pathname.includes("/ir/")) &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // McKesson IR q4cdn (128197368) Presentation + Earnings/Press Release.
  if (
    (h === "s24.q4cdn.com" || h.endsWith(".q4cdn.com")) &&
    parsed.pathname.includes("/128197368/") &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // AppLovin IR q4cdn (165405286) Earnings Presentation / Shareholder Letter + Press Release.
  if (
    (h === "s21.q4cdn.com" || h.endsWith(".q4cdn.com")) &&
    parsed.pathname.includes("/165405286/") &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // GSK results slides + announcements under /media/.
  if (
    (h === "www.gsk.com" || h.endsWith(".gsk.com")) &&
    parsed.pathname.includes("/media/") &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // AIA Group (AAGIY) analyst presentations + results announcements.
  if (
    (h === "www.aia.com" || h.endsWith(".aia.com")) &&
    (parsed.pathname.includes("/investor-relations/") || parsed.pathname.includes("/content/dam/")) &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Sanofi quarterly results presentations + press releases.
  if (
    (h === "www.sanofi.com" || h.endsWith(".sanofi.com")) &&
    (parsed.pathname.includes("/events/") ||
      parsed.pathname.includes("/assets/") ||
      parsed.pathname.includes("/investors")) &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Equinix IR CloudFront earnings presentation + press/financials.
  if (
    (h === "d1io3yog0oux5.cloudfront.net" || h.endsWith(".cloudfront.net")) &&
    parsed.pathname.includes("/equinix/") &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // CaixaBank (CAIXY) English webcast presentations + financial reports.
  if (
    (h === "www.caixabank.com" || h.endsWith(".caixabank.com")) &&
    (parsed.pathname.includes("/Accionistasinversores/") ||
      parsed.pathname.includes("/PDFs/") ||
      parsed.pathname.includes("/deployedfiles/")) &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // ING Group results presentations + press releases.
  if (
    (h === "www.ing.com" || h === "ing.com" || h.endsWith(".ing.com")) &&
    (parsed.pathname.includes("/binaries/") ||
      parsed.pathname.includes("/documents/") ||
      parsed.pathname.includes("/results/")) &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Tokio Marine Holdings IR presentations + summary reports.
  if (
    (h === "www.tokiomarinehd.com" || h.endsWith(".tokiomarinehd.com")) &&
    (parsed.pathname.includes("/ir/") || parsed.pathname.includes("/presentation/")) &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Agnico Eagle IR presentations + news releases.
  if (
    (h === "ir.agnicoeagle.com" || h.endsWith(".agnicoeagle.com")) &&
    (parsed.pathname.includes("/files/") || parsed.pathname.includes("/doc_")) &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Airbnb IR q4cdn (656283129) shareholder letters.
  if (
    (h === "s26.q4cdn.com" || h.endsWith(".q4cdn.com")) &&
    parsed.pathname.includes("/656283129/") &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Equinor IR Sanity CDN presentations + financial statements/reviews.
  if (
    (h === "cdn.sanity.io" || h.endsWith(".sanity.io")) &&
    parsed.pathname.includes("/files/") &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Southern Company IR q4cdn (273397814) earnings call decks + press releases.
  if (
    (h === "s27.q4cdn.com" || h.endsWith(".q4cdn.com")) &&
    parsed.pathname.includes("/273397814/") &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Quanta Services IR CloudFront-style _assets presentations + press releases.
  if (
    (h === "investors.quantaservices.com" || h.endsWith(".quantaservices.com")) &&
    (parsed.pathname.includes("/_assets/") || parsed.pathname.includes("/quantaservices/")) &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Vertiv IR q4cdn (554782763) results presentations + earnings releases.
  if (
    (h === "s205.q4cdn.com" || h.endsWith(".q4cdn.com")) &&
    parsed.pathname.includes("/554782763/") &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // ICICI Bank IR DAM presentations + performance reviews.
  if (
    (h === "www.icici.bank.in" ||
      h.endsWith(".icici.bank.in") ||
      h === "www.icicibank.com" ||
      h.endsWith(".icicibank.com")) &&
    (parsed.pathname.includes("/investor/") ||
      parsed.pathname.includes("/quarterly-financial-results/") ||
      parsed.pathname.includes("/managed-assets/")) &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Enel IR trimestrali results packs + English press PDFs.
  if (
    (h === "www.enel.com" || h.endsWith(".enel.com")) &&
    (parsed.pathname.includes("/content/dam/") ||
      parsed.pathname.includes("/documenti/") ||
      parsed.pathname.includes("/press/")) &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
  // Atlas Copco Group IR handouts + interim reports.
  if (
    (h === "www.atlascopcogroup.com" ||
      h.endsWith(".atlascopcogroup.com") ||
      h === "www.atlascopco.com" ||
      h.endsWith(".atlascopco.com")) &&
    (parsed.pathname.includes("/investors/") ||
      parsed.pathname.includes("/financial-publications/") ||
      parsed.pathname.includes("/content/dam/")) &&
    /\.pdf(?:$|[?#])/i.test(parsed.pathname)
  ) {
    return true;
  }
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
