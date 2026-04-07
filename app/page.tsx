import { BahayGoHomeMarketplace } from "@/components/marketplace/fishnet-home-marketplace";
import { WelcomeOnboarding } from "@/components/marketplace/welcome-onboarding";

export default function HomePage() {
  return (
    <>
      <WelcomeOnboarding />
      <BahayGoHomeMarketplace listingMode="rent" />
    </>
  );
}
