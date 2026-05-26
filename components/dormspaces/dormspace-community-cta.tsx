"use client";

import { BadgeCheck, Building2, ShieldCheck } from "lucide-react";

import { ProductCrossBanner } from "@/components/marketplace/product-cross-banner";
import { BAHAYGO_MARKETPLACE_BANNER_IMAGE } from "@/lib/dormspaces";

const FEATURES = [
  { icon: ShieldCheck, line1: "Verified", line2: "Agents" },
  { icon: Building2, line1: "Licensed", line2: "Agencies" },
  { icon: BadgeCheck, line1: "Anti-Scam", line2: "Protection" },
] as const;

export function DormspaceCommunityCta() {
  return (
    <section className="px-4 py-6 sm:px-6 sm:py-8">
      <ProductCrossBanner
        id="dormspace-bahaygo-banner-heading"
        eyebrow={
          <span className="text-[8px] font-bold uppercase tracking-[0.14em] text-[#D4A843]/90 sm:text-[10px]">
            BahayGo marketplace
          </span>
        }
        headline={
          <>
            Find a home, made <span className="text-[#D4A843]">simple.</span>
          </>
        }
        subline="Verified agents. Real listings. Across the Philippines."
        features={FEATURES}
        imageSrc={BAHAYGO_MARKETPLACE_BANNER_IMAGE}
        bgClassName="bg-[#2C2C2C]"
        gradientFrom="#2C2C2C"
        pills={[
          { label: "Explore BahayGo", href: "/", variant: "primary" },
          { label: "Sign up", href: "/auth/register?next=/", variant: "outline" },
        ]}
      />
    </section>
  );
}
