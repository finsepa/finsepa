import { Superinvestor13fProfile } from "@/components/superinvestors/superinvestor-13f-profile";
import { getHimalayaHoldingsComparison } from "@/lib/superinvestors/berkshire-13f";

export const dynamic = "force-dynamic";

const PROFILE_AVATAR = "/superinvestors/li-lu.png";

export default async function LiLu13fPage() {
  const data = await getHimalayaHoldingsComparison();

  return (
    <Superinvestor13fProfile
      profileName="Li Lu"
      breadcrumbCurrentLabel="Li Lu"
      avatarSrc={PROFILE_AVATAR}
      data={data}
    />
  );
}

