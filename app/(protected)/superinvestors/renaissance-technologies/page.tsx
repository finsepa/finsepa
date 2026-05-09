import { Superinvestor13fProfile } from "@/components/superinvestors/superinvestor-13f-profile";
import { getRenaissanceTechnologiesHoldingsComparison } from "@/lib/superinvestors/berkshire-13f";

export const dynamic = "force-dynamic";

export default async function RenaissanceTechnologies13fPage() {
  const data = await getRenaissanceTechnologiesHoldingsComparison();

  return (
    <Superinvestor13fProfile
      profileName="Jim Simons"
      breadcrumbCurrentLabel="Jim Simons"
      avatarSrc="/superinvestors/jim-simons.png"
      data={data}
    />
  );
}
