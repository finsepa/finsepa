import { Superinvestor13fProfile } from "@/components/superinvestors/superinvestor-13f-profile";
import { getGmoHoldingsComparison } from "@/lib/superinvestors/berkshire-13f";

export const dynamic = "force-dynamic";

export default async function JeremyGrantham13fPage() {
  const data = await getGmoHoldingsComparison();

  return (
    <Superinvestor13fProfile
      profileName="Jeremy Grantham"
      breadcrumbCurrentLabel="Jeremy Grantham"
      avatarSrc="/superinvestors/jeremy-grantham.png"
      data={data}
    />
  );
}
