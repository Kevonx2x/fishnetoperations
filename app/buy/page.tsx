import { Suspense } from "react";
import { BahayGoHomeMarketplace } from "@/components/marketplace/fishnet-home-marketplace";

export default function BuyPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <BahayGoHomeMarketplace listingMode="buy" />
    </Suspense>
  );
}
