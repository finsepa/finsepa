import { Superinvestor13fProfile } from "@/components/superinvestors/superinvestor-13f-profile";
import { getScionHoldingsComparison } from "@/lib/superinvestors/berkshire-13f";

export const dynamic = "force-dynamic";

const PROFILE_AVATAR = "/superinvestors/michael-burry.png";

export default async function MichaelBurry13fPage() {
  const data = await getScionHoldingsComparison();

  return (
    <Superinvestor13fProfile
      profileName="Michael Burry"
      breadcrumbCurrentLabel="Michael Burry"
      avatarSrc={PROFILE_AVATAR}
      data={data}
    />
  );
}

