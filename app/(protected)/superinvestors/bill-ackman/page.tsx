import { Superinvestor13fProfile } from "@/components/superinvestors/superinvestor-13f-profile";
import { getPershingSquareHoldingsComparison } from "@/lib/superinvestors/berkshire-13f";

export const dynamic = "force-dynamic";

const PROFILE_AVATAR = "/superinvestors/bill-ackman.png";

export default async function BillAckman13fPage() {
  const data = await getPershingSquareHoldingsComparison();

  return (
    <Superinvestor13fProfile
      profileName="Bill Ackman"
      breadcrumbCurrentLabel="Bill Ackman"
      avatarSrc={PROFILE_AVATAR}
      data={data}
    />
  );
}
