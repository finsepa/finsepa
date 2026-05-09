import { Superinvestor13fProfile } from "@/components/superinvestors/superinvestor-13f-profile";
import { getTciFundHoldingsComparison } from "@/lib/superinvestors/berkshire-13f";

export const dynamic = "force-dynamic";

export default async function ChrisHohn13fPage() {
  const data = await getTciFundHoldingsComparison();

  return (
    <Superinvestor13fProfile
      profileName="Chris Hohn"
      breadcrumbCurrentLabel="Chris Hohn"
      avatarSrc="/superinvestors/chris-hohn.png"
      data={data}
    />
  );
}
