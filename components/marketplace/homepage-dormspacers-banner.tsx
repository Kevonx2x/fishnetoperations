"use client";

import { MessageCircle, ShieldCheck, Users } from "lucide-react";

import { BahayGoHouseMark } from "@/components/dormspaces/dormspace-welcome-logo";
import { ProductCrossBanner } from "@/components/marketplace/product-cross-banner";
import { DORMSPACE_COMMUNITY_BANNER_IMAGE } from "@/lib/dormspaces";

const FEATURES = [
  { icon: ShieldCheck, line1: "Verified", line2: "Listings" },
  { icon: MessageCircle, line1: "Direct", line2: "Messaging" },
  { icon: Users, line1: "Student", line2: "Community" },
] as const;

export function HomepageDormspacersBanner() {
  return (
    <div className="mt-6 px-4 lg:mt-10 lg:px-0">
      <ProductCrossBanner
        id="homepage-dormspacers-banner-heading"
        eyebrow={
          <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-white/20 px-2 py-0.5 sm:gap-2 sm:px-3 sm:py-1">
            <BahayGoHouseMark className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            <span className="text-[8px] font-bold uppercase tracking-[0.14em] text-white/70 sm:text-[10px]">
              BahayGo dormspacers
            </span>
          </div>
        }
        headline={
          <>
            Your campus life, made <span className="text-[#D4A843]">easier.</span>
          </>
        }
        subline="Verified dorms. Real people. Better living."
        features={FEATURES}
        imageSrc={DORMSPACE_COMMUNITY_BANNER_IMAGE}
        pills={[
          { label: "Explore dormspaces", href: "/dormspaces", variant: "primary" },
          { label: "Sign up", href: "/auth/register?next=/dormspaces", variant: "outline" },
        ]}
      />
    </div>
  );
}
