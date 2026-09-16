import "server-only";

import { applyKnownCdnSlideDeckUrls } from "@/lib/market/ir-seed-apply-known-cdn";
import { applyIrSeedGoogleAlphabetDocumentUrls } from "@/lib/market/ir-seed-apply-google-alphabet";
import { applyIrSeedGenericQ4DocumentUrls } from "@/lib/market/ir-seed-apply-generic-q4";
import { applyIrSeedAbbvDocumentUrls } from "@/lib/market/ir-seed-apply-abbv";
import { applyIrSeedAdbeDocumentUrls } from "@/lib/market/ir-seed-apply-adbe";
import { applyIrSeedAmazonDocumentUrls } from "@/lib/market/ir-seed-apply-amazon";
import { applyIrSeedAppleDocumentUrls } from "@/lib/market/ir-seed-apply-apple";
import { applyIrSeedAsmlDocumentUrls } from "@/lib/market/ir-seed-apply-asml";
import { applyIrSeedAvgoDocumentUrls } from "@/lib/market/ir-seed-apply-avgo";
import { applyIrSeedCscoDocumentUrls } from "@/lib/market/ir-seed-apply-csco";
import { applyIrSeedBacDocumentUrls } from "@/lib/market/ir-seed-apply-bac";
import { applyIrSeedJnjDocumentUrls } from "@/lib/market/ir-seed-apply-jnj";
import { applyIrSeedJpmDocumentUrls } from "@/lib/market/ir-seed-apply-jpm";
import { applyIrSeedLillyDocumentUrls } from "@/lib/market/ir-seed-apply-lilly";
import { applyIrSeedMaDocumentUrls } from "@/lib/market/ir-seed-apply-ma";
import { applyIrSeedMetaDocumentUrls } from "@/lib/market/ir-seed-apply-meta";
import { applyIrSeedMuDocumentUrls } from "@/lib/market/ir-seed-apply-mu";
import { applyIrSeedNikeDocumentUrls } from "@/lib/market/ir-seed-apply-nike";
import { applyIrSeedNvidiaPresentationUrls } from "@/lib/market/ir-seed-apply-nvidia-q4";
import { applyIrSeedOrclDocumentUrls } from "@/lib/market/ir-seed-apply-orcl";
import { applyIrSeedPgDocumentUrls } from "@/lib/market/ir-seed-apply-pg";
import { applyIrSeedTcehyDocumentUrls } from "@/lib/market/ir-seed-apply-tcehy";
import { applyIrSeedTeslaDocumentUrls } from "@/lib/market/ir-seed-apply-tesla";
import { applyIrSeedTsmcDocumentUrls } from "@/lib/market/ir-seed-apply-tsmc";
import { applyIrSeedFerrariPresentationUrls } from "@/lib/market/ir-seed-apply-ferrari";
import { applyGcsWebPresentationUrls } from "@/lib/market/ir-seed-apply-gcs-presentations";
import { applyIrSeedVisaDocumentUrls } from "@/lib/market/ir-seed-apply-visa";
import { applyIrSeedWalmartDocumentUrls } from "@/lib/market/ir-seed-apply-walmart";
import { applyIrSeedXomDocumentUrls } from "@/lib/market/ir-seed-apply-xom";
import { applyIrSeedAmatDocumentUrls } from "@/lib/market/ir-seed-apply-amat";
import { applyIrSeedMerckDocumentUrls } from "@/lib/market/ir-seed-apply-merck";
import { applyIrSeedCostDocumentUrls } from "@/lib/market/ir-seed-apply-cost";
import { applyIrSeedKoDocumentUrls } from "@/lib/market/ir-seed-apply-ko";
import { applyIrSeedCatDocumentUrls } from "@/lib/market/ir-seed-apply-cat";
import { applyIrSeedPltrDocumentUrls } from "@/lib/market/ir-seed-apply-pltr";
import { applyIrSeedUnhDocumentUrls } from "@/lib/market/ir-seed-apply-unh";
import { applyIrSeedLrcxDocumentUrls } from "@/lib/market/ir-seed-apply-lrcx";
import { applyIrSeedCvxDocumentUrls } from "@/lib/market/ir-seed-apply-cvx";
import { applyIrSeedHsbcDocumentUrls } from "@/lib/market/ir-seed-apply-hsbc";
import { applyIrSeedDellDocumentUrls } from "@/lib/market/ir-seed-apply-dell";
import { applyIrSeedMsDocumentUrls } from "@/lib/market/ir-seed-apply-ms";
import { applyIrSeedGeDocumentUrls } from "@/lib/market/ir-seed-apply-ge";
import { applyIrSeedNflxDocumentUrls } from "@/lib/market/ir-seed-apply-nflx";
import { applyIrSeedHdDocumentUrls } from "@/lib/market/ir-seed-apply-hd";
import { applyIrSeedGsDocumentUrls } from "@/lib/market/ir-seed-apply-gs";
import { applyIrSeedPmDocumentUrls } from "@/lib/market/ir-seed-apply-pm";
import { applyIrSeedRyDocumentUrls } from "@/lib/market/ir-seed-apply-ry";
import { applyIrSeedArmDocumentUrls } from "@/lib/market/ir-seed-apply-arm";
import { applyIrSeedBabaDocumentUrls } from "@/lib/market/ir-seed-apply-baba";
import { applyIrSeedPanwDocumentUrls } from "@/lib/market/ir-seed-apply-panw";
import { applyIrSeedShelDocumentUrls } from "@/lib/market/ir-seed-apply-shel";
import { applyIrSeedWfcDocumentUrls } from "@/lib/market/ir-seed-apply-wfc";
import { applyIrSeedRtxDocumentUrls } from "@/lib/market/ir-seed-apply-rtx";
import { applyIrSeedNvsDocumentUrls } from "@/lib/market/ir-seed-apply-nvs";
import { applyIrSeedMufgDocumentUrls } from "@/lib/market/ir-seed-apply-mufg";
import { applyIrSeedSndkDocumentUrls } from "@/lib/market/ir-seed-apply-sndk";
import { applyIrSeedNsrgyDocumentUrls } from "@/lib/market/ir-seed-apply-nsrgy";
import { applyIrSeedGevDocumentUrls } from "@/lib/market/ir-seed-apply-gev";
import { applyIrSeedAznDocumentUrls } from "@/lib/market/ir-seed-apply-azn";
import { applyIrSeedAnetDocumentUrls } from "@/lib/market/ir-seed-apply-anet";
import { applyIrSeedSiegyDocumentUrls } from "@/lib/market/ir-seed-apply-siegy";
import { applyIrSeedSapDocumentUrls } from "@/lib/market/ir-seed-apply-sap";
import { applyIrSeedLvmuyDocumentUrls } from "@/lib/market/ir-seed-apply-lvmuy";
import { applyIrSeedLrlcyDocumentUrls } from "@/lib/market/ir-seed-apply-lrlcy";
import { applyIrSeedKlacDocumentUrls } from "@/lib/market/ir-seed-apply-klac";
import { applyIrSeedTxnDocumentUrls } from "@/lib/market/ir-seed-apply-txn";
import { applyIrSeedSftbyDocumentUrls } from "@/lib/market/ir-seed-apply-sftby";
import { applyIrSeedBhpDocumentUrls } from "@/lib/market/ir-seed-apply-bhp";
import { applyIrSeedCDocumentUrls } from "@/lib/market/ir-seed-apply-c";
import { applyIrSeedTmDocumentUrls } from "@/lib/market/ir-seed-apply-tm";
import { applyIrSeedIbmDocumentUrls } from "@/lib/market/ir-seed-apply-ibm";
import { applyIrSeedTmoDocumentUrls } from "@/lib/market/ir-seed-apply-tmo";
import { applyIrSeedAxpDocumentUrls } from "@/lib/market/ir-seed-apply-axp";
import { applyIrSeedLinDocumentUrls } from "@/lib/market/ir-seed-apply-lin";
import { applyIrSeedSanDocumentUrls } from "@/lib/market/ir-seed-apply-san";
import { applyIrSeedCrwdDocumentUrls } from "@/lib/market/ir-seed-apply-crwd";
import { applyIrSeedAmdDocumentUrls } from "@/lib/market/ir-seed-apply-amd";
import { applyIrSeedAmgnDocumentUrls } from "@/lib/market/ir-seed-apply-amgn";
import { applyIrSeedCrmDocumentUrls } from "@/lib/market/ir-seed-apply-crm";
import { applyIrSeedDisDocumentUrls } from "@/lib/market/ir-seed-apply-dis";
import { applyIrSeedIntuDocumentUrls } from "@/lib/market/ir-seed-apply-intu";
import { applyIrSeedMrvlDocumentUrls } from "@/lib/market/ir-seed-apply-mrvl";
import { applyIrSeedPepDocumentUrls } from "@/lib/market/ir-seed-apply-pep";
import { applyIrSeedAbtDocumentUrls } from "@/lib/market/ir-seed-apply-abt";
import { applyIrSeedAdiDocumentUrls } from "@/lib/market/ir-seed-apply-adi";
import { applyIrSeedAphDocumentUrls } from "@/lib/market/ir-seed-apply-aph";
import { applyIrSeedBlkDocumentUrls } from "@/lib/market/ir-seed-apply-blk";
import { applyIrSeedBaDocumentUrls } from "@/lib/market/ir-seed-apply-ba";
import { applyIrSeedCopDocumentUrls } from "@/lib/market/ir-seed-apply-cop";
import { applyIrSeedDeDocumentUrls } from "@/lib/market/ir-seed-apply-de";
import { applyIrSeedGildDocumentUrls } from "@/lib/market/ir-seed-apply-gild";
import { applyIrSeedMcdDocumentUrls } from "@/lib/market/ir-seed-apply-mcd";
import { applyIrSeedNeeDocumentUrls } from "@/lib/market/ir-seed-apply-nee";
import { applyIrSeedNvoDocumentUrls } from "@/lib/market/ir-seed-apply-nvo";
import { applyIrSeedQcomDocumentUrls } from "@/lib/market/ir-seed-apply-qcom";
import { applyIrSeedRioDocumentUrls } from "@/lib/market/ir-seed-apply-rio";
import { applyIrSeedSchwDocumentUrls } from "@/lib/market/ir-seed-apply-schw";
import { applyIrSeedSccoDocumentUrls } from "@/lib/market/ir-seed-apply-scco";
import { applyIrSeedShopDocumentUrls } from "@/lib/market/ir-seed-apply-shop";
import { applyIrSeedSmfgDocumentUrls } from "@/lib/market/ir-seed-apply-smfg";
import { applyIrSeedStxDocumentUrls } from "@/lib/market/ir-seed-apply-stx";
import { applyIrSeedTDocumentUrls } from "@/lib/market/ir-seed-apply-t";
import { applyIrSeedTdDocumentUrls } from "@/lib/market/ir-seed-apply-td";
import { applyIrSeedTmusDocumentUrls } from "@/lib/market/ir-seed-apply-tmus";
import { applyIrSeedTteDocumentUrls } from "@/lib/market/ir-seed-apply-tte";
import { applyIrSeedUbsDocumentUrls } from "@/lib/market/ir-seed-apply-ubs";
import { applyIrSeedUnpDocumentUrls } from "@/lib/market/ir-seed-apply-unp";
import { applyIrSeedVzDocumentUrls } from "@/lib/market/ir-seed-apply-vz";
import { applyIrSeedWdcDocumentUrls } from "@/lib/market/ir-seed-apply-wdc";
import { applyIrSeedWellDocumentUrls } from "@/lib/market/ir-seed-apply-well";
import { applyIrSeedPfeDocumentUrls } from "@/lib/market/ir-seed-apply-pfe";
import { applyIrSeedBbvaDocumentUrls } from "@/lib/market/ir-seed-apply-bbva";
import { applyIrSeedBudDocumentUrls } from "@/lib/market/ir-seed-apply-bud";
import { applyIrSeedIbkrDocumentUrls } from "@/lib/market/ir-seed-apply-ibkr";
import { applyIrSeedEtnDocumentUrls } from "@/lib/market/ir-seed-apply-etn";
import { applyIrSeedBxDocumentUrls } from "@/lib/market/ir-seed-apply-bx";
import { applyIrSeedUberDocumentUrls } from "@/lib/market/ir-seed-apply-uber";
import { applyIrSeedNowDocumentUrls } from "@/lib/market/ir-seed-apply-now";
import { applyIrSeedSonyDocumentUrls } from "@/lib/market/ir-seed-apply-sony";
import { applyIrSeedDhrDocumentUrls } from "@/lib/market/ir-seed-apply-dhr";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

/** Tickers with bespoke IR seed modules (run before universal layers). */
const DEDICATED_IR_SEED_TICKERS = new Set([
  "NKE",
  "NVDA",
  "GOOGL",
  "GOOG",
  "AAPL",
  "AMZN",
  "META",
  "MU",
  "TSM",
  "V",
  "RACE",
  "PG",
  "WMT",
  "LLY",
  "TSLA",
  "JNJ",
  "AVGO",
  "ASML",
  "ORCL",
  "XOM",
  "BAC",
  "MA",
  "JPM",
  "TCEHY",
  "ABBV",
  "ADBE",
  "CSCO",
  "AMAT",
  "MRK",
  "COST",
  "KO",
  "CAT",
  "PLTR",
  "UNH",
  "LRCX",
  "CVX",
  "HSBC",
  "DELL",
  "MS",
  "GE",
  "NFLX",
  "HD",
  "GS",
  "PM",
  "RY",
  "ARM",
  "BABA",
  "PANW",
  "SHEL",
  "WFC",
  "RTX",
  "NVS",
  "MUFG",
  "SNDK",
  "NSRGY",
  "GEV",
  "AZN",
  "ANET",
  "SIEGY",
  "SAP",
  "LVMUY",
  "LRLCY",
  "KLAC",
  "TXN",
  "SFTBY",
  "BHP",
  "C",
  "TM",
  "IBM",
  "TMO",
  "AXP",
  "LIN",
  "SAN",
  "CRWD",
  "AMGN",
  "MRVL",
  "VZ",
  "TTE",
  "STX",
  "CRM",
  "DIS",
  "AMD",
  "PEP",
  "INTU",
  "QCOM",
  "APH",
  "TD",
  "TMUS",
  "NVO",
  "SCHW",
  "ADI",
  "DE",
  "MCD",
  "T",
  "GILD",
  "ABT",
  "BLK",
  "NEE",
  "RIO",
  "WELL",
  "UNP",
  "SMFG",
  "WDC",
  "UBS",
  "COP",
  "BA",
  "SHOP",
  "SCCO",
  "PFE",
  "BBVA",
  "BUD",
  "IBKR",
  "ETN",
  "BX",
  "UBER",
  "NOW",
  "SONY",
  "DHR",
]);

export function earningsIrSeedResolutionSource(
  listingTicker: string,
): "ir_seed" | "generic_q4" {
  const t = listingTicker.trim().toUpperCase();
  return DEDICATED_IR_SEED_TICKERS.has(t) ? "ir_seed" : "generic_q4";
}

async function applyDedicatedIrSeedDocumentUrls(
  listingTicker: string,
  rows: StockEarningsHistoryRow[],
  hub: StockEarningsDocumentHub,
  options?: { preview?: boolean; fyEndMonthDay?: string | null },
): Promise<StockEarningsHistoryRow[] | null> {
  const t = listingTicker.trim().toUpperCase();
  if (t === "NKE") return applyIrSeedNikeDocumentUrls(rows);
  if (t === "PG") return applyIrSeedPgDocumentUrls(rows);
  if (t === "NVDA") return applyIrSeedNvidiaPresentationUrls(rows);
  if (t === "GOOGL" || t === "GOOG") return applyIrSeedGoogleAlphabetDocumentUrls(rows, hub);
  if (t === "AAPL") return applyIrSeedAppleDocumentUrls(rows, hub);
  if (t === "AMZN") return applyIrSeedAmazonDocumentUrls(rows, hub);
  if (t === "MU") return applyIrSeedMuDocumentUrls(rows, hub);
  if (t === "META") return applyIrSeedMetaDocumentUrls(rows, hub);
  if (t === "TSM") return applyIrSeedTsmcDocumentUrls(rows, hub);
  if (t === "V") return applyIrSeedVisaDocumentUrls(rows, hub);
  if (t === "WMT") return applyIrSeedWalmartDocumentUrls(rows, hub);
  if (t === "LLY") return applyIrSeedLillyDocumentUrls(rows, hub);
  if (t === "TSLA") return applyIrSeedTeslaDocumentUrls(rows);
  if (t === "JNJ") return applyIrSeedJnjDocumentUrls(rows);
  if (t === "AVGO") return applyIrSeedAvgoDocumentUrls(rows, hub);
  if (t === "ASML") return applyIrSeedAsmlDocumentUrls(rows, hub);
  if (t === "ORCL") return applyIrSeedOrclDocumentUrls(rows);
  if (t === "XOM") return applyIrSeedXomDocumentUrls(rows, hub);
  if (t === "BAC") return applyIrSeedBacDocumentUrls(rows, hub);
  if (t === "MA") return applyIrSeedMaDocumentUrls(rows);
  if (t === "JPM") return applyIrSeedJpmDocumentUrls(rows, hub);
  if (t === "TCEHY") return applyIrSeedTcehyDocumentUrls(rows, hub);
  if (t === "ABBV") return applyIrSeedAbbvDocumentUrls(rows, hub);
  if (t === "ADBE") return applyIrSeedAdbeDocumentUrls(rows, hub);
  if (t === "CSCO") return applyIrSeedCscoDocumentUrls(rows, hub);
  if (t === "AMAT") return applyIrSeedAmatDocumentUrls(rows, hub);
  if (t === "MRK") return applyIrSeedMerckDocumentUrls(rows, hub);
  if (t === "COST") return applyIrSeedCostDocumentUrls(rows, hub);
  if (t === "KO") return applyIrSeedKoDocumentUrls(rows, hub);
  if (t === "CAT") return applyIrSeedCatDocumentUrls(rows, hub);
  if (t === "PLTR") return applyIrSeedPltrDocumentUrls(rows, hub);
  if (t === "UNH") return applyIrSeedUnhDocumentUrls(rows, hub);
  if (t === "LRCX") return applyIrSeedLrcxDocumentUrls(rows, hub);
  if (t === "CVX") return applyIrSeedCvxDocumentUrls(rows, hub);
  if (t === "HSBC") return applyIrSeedHsbcDocumentUrls(rows, hub);
  if (t === "DELL") return applyIrSeedDellDocumentUrls(rows, hub);
  if (t === "MS") return applyIrSeedMsDocumentUrls(rows, hub);
  if (t === "GE") return applyIrSeedGeDocumentUrls(rows, hub);
  if (t === "NFLX") return applyIrSeedNflxDocumentUrls(rows, hub);
  if (t === "HD") return applyIrSeedHdDocumentUrls(rows, hub);
  if (t === "GS") return applyIrSeedGsDocumentUrls(rows, hub);
  if (t === "PM") return applyIrSeedPmDocumentUrls(rows, hub);
  if (t === "RY") return applyIrSeedRyDocumentUrls(rows, hub);
  if (t === "ARM") return applyIrSeedArmDocumentUrls(rows, hub);
  if (t === "BABA") return applyIrSeedBabaDocumentUrls(rows, hub);
  if (t === "PANW") return applyIrSeedPanwDocumentUrls(rows, hub);
  if (t === "SHEL") return applyIrSeedShelDocumentUrls(rows, hub);
  if (t === "WFC") return applyIrSeedWfcDocumentUrls(rows, hub);
  if (t === "RTX") return applyIrSeedRtxDocumentUrls(rows, hub);
  if (t === "NVS") return applyIrSeedNvsDocumentUrls(rows, hub);
  if (t === "MUFG") return applyIrSeedMufgDocumentUrls(rows, hub);
  if (t === "SNDK") return applyIrSeedSndkDocumentUrls(rows, hub);
  if (t === "NSRGY") return applyIrSeedNsrgyDocumentUrls(rows, hub);
  if (t === "GEV") return applyIrSeedGevDocumentUrls(rows, hub);
  if (t === "AZN") return applyIrSeedAznDocumentUrls(rows, hub);
  if (t === "ANET") return applyIrSeedAnetDocumentUrls(rows, hub);
  if (t === "SIEGY") return applyIrSeedSiegyDocumentUrls(rows, hub);
  if (t === "SAP") return applyIrSeedSapDocumentUrls(rows, hub);
  if (t === "LVMUY") return applyIrSeedLvmuyDocumentUrls(rows, hub);
  if (t === "LRLCY") return applyIrSeedLrlcyDocumentUrls(rows, hub);
  if (t === "KLAC") return applyIrSeedKlacDocumentUrls(rows, hub);
  if (t === "TXN") return applyIrSeedTxnDocumentUrls(rows, hub);
  if (t === "SFTBY") return applyIrSeedSftbyDocumentUrls(rows, hub);
  if (t === "BHP") return applyIrSeedBhpDocumentUrls(rows, hub);
  if (t === "C") return applyIrSeedCDocumentUrls(rows, hub);
  if (t === "TM") return applyIrSeedTmDocumentUrls(rows, hub);
  if (t === "IBM") return applyIrSeedIbmDocumentUrls(rows, hub);
  if (t === "TMO") return applyIrSeedTmoDocumentUrls(rows, hub);
  if (t === "AXP") return applyIrSeedAxpDocumentUrls(rows, hub);
  if (t === "LIN") return applyIrSeedLinDocumentUrls(rows, hub);
  if (t === "SAN") return applyIrSeedSanDocumentUrls(rows, hub);
  if (t === "CRWD") return applyIrSeedCrwdDocumentUrls(rows, hub);
  if (t === "AMGN") return applyIrSeedAmgnDocumentUrls(rows, hub);
  if (t === "MRVL") return applyIrSeedMrvlDocumentUrls(rows, hub);
  if (t === "VZ") return applyIrSeedVzDocumentUrls(rows, hub);
  if (t === "TTE") return applyIrSeedTteDocumentUrls(rows, hub);
  if (t === "STX") return applyIrSeedStxDocumentUrls(rows, hub);
  if (t === "CRM") return applyIrSeedCrmDocumentUrls(rows, hub);
  if (t === "DIS") return applyIrSeedDisDocumentUrls(rows, hub);
  if (t === "AMD") return applyIrSeedAmdDocumentUrls(rows, hub);
  if (t === "PEP") return applyIrSeedPepDocumentUrls(rows, hub);
  if (t === "INTU") return applyIrSeedIntuDocumentUrls(rows, hub);
  if (t === "QCOM") return applyIrSeedQcomDocumentUrls(rows, hub);
  if (t === "APH") return applyIrSeedAphDocumentUrls(rows, hub);
  if (t === "TD") return applyIrSeedTdDocumentUrls(rows, hub);
  if (t === "TMUS") return applyIrSeedTmusDocumentUrls(rows, hub);
  if (t === "NVO") return applyIrSeedNvoDocumentUrls(rows, hub);
  if (t === "SCHW") return applyIrSeedSchwDocumentUrls(rows, hub);
  if (t === "ADI") return applyIrSeedAdiDocumentUrls(rows, hub);
  if (t === "DE") return applyIrSeedDeDocumentUrls(rows, hub);
  if (t === "MCD") return applyIrSeedMcdDocumentUrls(rows, hub);
  if (t === "T") return applyIrSeedTDocumentUrls(rows, hub);
  if (t === "GILD") return applyIrSeedGildDocumentUrls(rows, hub);
  if (t === "ABT") return applyIrSeedAbtDocumentUrls(rows, hub);
  if (t === "BLK") return applyIrSeedBlkDocumentUrls(rows, hub);
  if (t === "NEE") return applyIrSeedNeeDocumentUrls(rows, hub);
  if (t === "RIO") return applyIrSeedRioDocumentUrls(rows, hub);
  if (t === "WELL") return applyIrSeedWellDocumentUrls(rows, hub);
  if (t === "UNP") return applyIrSeedUnpDocumentUrls(rows, hub);
  if (t === "SMFG") return applyIrSeedSmfgDocumentUrls(rows, hub);
  if (t === "WDC") return applyIrSeedWdcDocumentUrls(rows, hub);
  if (t === "UBS") return applyIrSeedUbsDocumentUrls(rows, hub);
  if (t === "COP") return applyIrSeedCopDocumentUrls(rows, hub);
  if (t === "BA") return applyIrSeedBaDocumentUrls(rows, hub);
  if (t === "SHOP") return applyIrSeedShopDocumentUrls(rows, hub);
  if (t === "SCCO") return applyIrSeedSccoDocumentUrls(rows, hub);
  if (t === "PFE") return applyIrSeedPfeDocumentUrls(rows, hub);
  if (t === "BBVA") return applyIrSeedBbvaDocumentUrls(rows, hub);
  if (t === "BUD") return applyIrSeedBudDocumentUrls(rows, hub);
  if (t === "IBKR") return applyIrSeedIbkrDocumentUrls(rows, hub);
  if (t === "ETN") return applyIrSeedEtnDocumentUrls(rows, hub);
  if (t === "BX") return applyIrSeedBxDocumentUrls(rows, hub);
  if (t === "UBER") return applyIrSeedUberDocumentUrls(rows, hub);
  if (t === "NOW") return applyIrSeedNowDocumentUrls(rows, hub);
  if (t === "SONY") return applyIrSeedSonyDocumentUrls(rows, hub);
  if (t === "DHR") return applyIrSeedDhrDocumentUrls(rows, hub);
  if (t === "RACE") {
    return applyIrSeedFerrariPresentationUrls(rows, {
      preview: options?.preview,
      fyEndMonthDay: options?.fyEndMonthDay,
    });
  }
  return null;
}

async function applyUniversalIrSeedLayers(
  listingTicker: string,
  rows: StockEarningsHistoryRow[],
  hub: StockEarningsDocumentHub,
  options?: { preview?: boolean; fyEndMonthDay?: string | null },
): Promise<StockEarningsHistoryRow[]> {
  const withKnownCdn = await applyKnownCdnSlideDeckUrls(listingTicker, rows, hub, options);
  return applyGcsWebPresentationUrls(listingTicker, withKnownCdn, hub, options);
}

/** IR seed resolution after SEC enrichment; curated QA overrides run after this in the tab payload. */
export async function applyIrSeedDocumentUrls(
  listingTicker: string,
  rows: StockEarningsHistoryRow[],
  hub: StockEarningsDocumentHub,
  options?: {
    preview?: boolean;
    fyEndMonthDay?: string | null;
    /** Vault / cron backfill only — user tab traffic should not run the generic HEAD grid. */
    allowGenericQ4?: boolean;
  },
): Promise<StockEarningsHistoryRow[]> {
  const t = listingTicker.trim().toUpperCase();
  const dedicated = await applyDedicatedIrSeedDocumentUrls(t, rows, hub, options);
  const allowGeneric = options?.allowGenericQ4 !== false;
  const seeded =
    dedicated ??
    (allowGeneric
      ? await applyIrSeedGenericQ4DocumentUrls(t, rows, hub, {
          preview: options?.preview,
          fyEndMonthDay: options?.fyEndMonthDay,
        })
      : rows);
  return applyUniversalIrSeedLayers(t, seeded, hub, options);
}
