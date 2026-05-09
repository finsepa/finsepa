/**
 * Max 13F holding rows per page on superinvestor profile tables.
 * Aligns with the stocks screener companies API ceiling (`Math.min(50, pageSize)` in
 * {@link buildScreenerCompaniesApiResponse}).
 */
export const SUPERINVESTOR_HOLDINGS_PAGE_SIZE = 50;
