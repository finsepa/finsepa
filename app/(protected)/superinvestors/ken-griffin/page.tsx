import { Superinvestor13fProfile } from "@/components/superinvestors/superinvestor-13f-profile";
import { getCitadelHoldingsComparison } from "@/lib/superinvestors/berkshire-13f";

export const dynamic = "force-dynamic";

export default async function KenGriffin13fPage() {
  const data = await getCitadelHoldingsComparison();

  return (
    <Superinvestor13fProfile
      profileName="Ken Griffin"
      breadcrumbCurrentLabel="Ken Griffin"
      avatarSrc="/superinvestors/ken-griffin.png"
      data={data}
    />
  );
}

