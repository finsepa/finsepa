import { Superinvestor13fProfile } from "@/components/superinvestors/superinvestor-13f-profile";
import { getPoint72HoldingsComparison } from "@/lib/superinvestors/berkshire-13f";

export const dynamic = "force-dynamic";

export default async function Point7213fPage() {
  const data = await getPoint72HoldingsComparison();

  return (
    <Superinvestor13fProfile
      profileName="Steven Cohen"
      breadcrumbCurrentLabel="Steven Cohen"
      avatarSrc="/superinvestors/steven-cohen.png"
      data={data}
    />
  );
}
