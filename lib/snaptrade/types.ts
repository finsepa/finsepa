export type SnapTradeConnectionSummary = {
  id: string;
  name: string | null;
  brokerageName: string | null;
  brokerageSlug: string | null;
  disabled: boolean;
  createdDate: string | null;
  connectionType: string | null;
};

export type SnapTradePortalResponse = {
  redirectUri: string;
};

export type SnapTradeStatusResponse = {
  configured: boolean;
  connected: boolean;
  connectionCount: number;
};
