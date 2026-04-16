import { Superinvestor13fProfile } from "@/components/superinvestors/superinvestor-13f-profile";
import { getFundsmithHoldingsComparison } from "@/lib/superinvestors/berkshire-13f";

export const dynamic = "force-dynamic";

const PROFILE_AVATAR = "/superinvestors/terry-smith.png";

export default async function TerrySmith13fPage() {
  const data = await getFundsmithHoldingsComparison();

  return (
    <Superinvestor13fProfile
      profileName="Terry Smith"
      breadcrumbCurrentLabel="Terry Smith"
      avatarSrc={PROFILE_AVATAR}
      data={data}
    />
  );
}
