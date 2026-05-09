import { Superinvestor13fProfile } from "@/components/superinvestors/superinvestor-13f-profile";
import { getPrimecapHoldingsComparison } from "@/lib/superinvestors/berkshire-13f";

export const dynamic = "force-dynamic";

export default async function PrimecapManagement13fPage() {
  const data = await getPrimecapHoldingsComparison();

  return (
    <Superinvestor13fProfile
      profileName="PRIMECAP Management"
      breadcrumbCurrentLabel="PRIMECAP Management"
      avatarSrc="/superinvestors/primecap-management.png"
      data={data}
    />
  );
}

