import { Superinvestor13fProfile } from "@/components/superinvestors/superinvestor-13f-profile";
import { getBlackrockHoldingsComparison } from "@/lib/superinvestors/berkshire-13f";

export const dynamic = "force-dynamic";

export default async function Blackrock13fPage() {
  const data = await getBlackrockHoldingsComparison();

  return (
    <Superinvestor13fProfile
      profileName="BlackRock"
      breadcrumbCurrentLabel="BlackRock"
      avatarSrc="/superinvestors/blackrock.png"
      data={data}
    />
  );
}
