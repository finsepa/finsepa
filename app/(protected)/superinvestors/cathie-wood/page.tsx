import { Superinvestor13fProfile } from "@/components/superinvestors/superinvestor-13f-profile";
import { getArkHoldingsComparison } from "@/lib/superinvestors/berkshire-13f";

export const dynamic = "force-dynamic";

const PROFILE_AVATAR = "/superinvestors/cathie-wood.png";

export default async function CathieWood13fPage() {
  const data = await getArkHoldingsComparison();

  return (
    <Superinvestor13fProfile
      profileName="Cathie Wood"
      breadcrumbCurrentLabel="Cathie Wood"
      avatarSrc={PROFILE_AVATAR}
      data={data}
    />
  );
}

