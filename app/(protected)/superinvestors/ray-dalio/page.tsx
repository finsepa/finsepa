import { Superinvestor13fProfile } from "@/components/superinvestors/superinvestor-13f-profile";
import { getBridgewaterHoldingsComparison } from "@/lib/superinvestors/berkshire-13f";

export const dynamic = "force-dynamic";

const PROFILE_AVATAR = "/superinvestors/ray-dalio.png";

export default async function RayDalio13fPage() {
  const data = await getBridgewaterHoldingsComparison();

  return (
    <Superinvestor13fProfile
      profileName="Ray Dalio"
      breadcrumbCurrentLabel="Ray Dalio"
      avatarSrc={PROFILE_AVATAR}
      data={data}
    />
  );
}

