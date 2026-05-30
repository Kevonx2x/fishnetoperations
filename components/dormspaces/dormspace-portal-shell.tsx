"use client";



import type { ReactNode } from "react";

import { usePathname } from "next/navigation";



import { DormspacePortalFooter } from "@/components/dormspaces/dormspace-portal-footer";

import { DormspacePortalNav } from "@/components/dormspaces/dormspace-portal-nav";

import { DormspacePortalWatermark } from "@/components/dormspaces/dormspace-portal-watermark";

import { dormspacePortalNavVisibility, isDormspaceMarketplaceHomePath } from "@/lib/dormspace-portal-chrome";

import type { DormspacePortalNavVariant } from "@/lib/dormspace-portal-nav";



type Props = {

  children: ReactNode;

  variant?: DormspacePortalNavVariant;

  activeLandlordTab?: "listings" | "inquiries" | "profile" | "account";

  minimalNav?: boolean;

  className?: string;

  /** Pin mobile layout to one viewport (welcome). */
  mobileFillViewport?: boolean;

  compactMobileNav?: boolean;

};



/** Shared dormspacers chrome: watermark + portal nav + content. */

export function DormspacePortalShell({

  children,

  variant,

  activeLandlordTab,

  minimalNav,

  className,

  mobileFillViewport = false,

  compactMobileNav = false,

}: Props) {

  const pathname = usePathname() ?? "";

  const navVisibility = dormspacePortalNavVisibility(pathname);
  const hideMobilePortalNav = isDormspaceMarketplaceHomePath(pathname);
  const showMobileBrandText = isDormspaceMarketplaceHomePath(pathname);

  const showPortalFooter =
    pathname === "/dormspaces" ||
    pathname.startsWith("/dormspaces/liked") ||
    pathname.startsWith("/dormspaces/search");



  return (

    <div
      className={`relative flex min-h-screen flex-col bg-[#FAF8F4] ${mobileFillViewport ? "max-md:h-[100dvh] max-md:max-h-[100dvh] max-md:overflow-hidden" : ""} ${className ?? ""}`}
    >

      <DormspacePortalWatermark showMobileBrandText={showMobileBrandText} />

      <div
        className={
          navVisibility === "desktop-only" || hideMobilePortalNav ? "hidden md:block" : undefined
        }
      >
        <DormspacePortalNav
          variant={variant}
          activeLandlordTab={activeLandlordTab}
          minimal={minimalNav ?? navVisibility === "minimal"}
          compactMobileHome={compactMobileNav}
        />
      </div>

      <div
        className={`relative z-10 flex min-w-0 flex-col ${mobileFillViewport ? "max-md:min-h-0 max-md:flex-1 max-md:overflow-hidden" : "max-md:flex-none md:flex-1"}`}
      >
        {children}
      </div>

      {showPortalFooter ? (
        <div className="hidden md:block">
          <DormspacePortalFooter />
        </div>
      ) : null}

    </div>

  );

}


