import { AuthCenteredLayout } from "@/components/auth/auth-centered-layout";

import { SnapTradeIOSCallbackClient } from "./snaptrade-ios-callback-client";

export const dynamic = "force-dynamic";

export default function SnapTradeIOSCallbackPage() {
  return (
    <AuthCenteredLayout split={false} compact title="Brokerage connected" subtitle="Returning to Finsepa…">
      <SnapTradeIOSCallbackClient />
    </AuthCenteredLayout>
  );
}
