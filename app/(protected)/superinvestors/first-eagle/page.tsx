import { Superinvestor13fProfile } from "@/components/superinvestors/superinvestor-13f-profile";
import { getFirstEagleHoldingsComparison } from "@/lib/superinvestors/berkshire-13f";

export const dynamic = "force-dynamic";

export default async function FirstEagle13fPage() {
  const data = await getFirstEagleHoldingsComparison();

  return (
    <Superinvestor13fProfile
      profileName="First Eagle Investments"
      breadcrumbCurrentLabel="First Eagle Investments"
      avatarSrc={null}
      data={data}
    />
  );
}
