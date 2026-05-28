"use client";



import type { ReactNode } from "react";

import { usePathname } from "next/navigation";



import { DormspacePortalFooter } from "@/components/dormspaces/dormspace-portal-footer";

import { DormspacePortalNav } from "@/components/dormspaces/dormspace-portal-nav";

import { DormspacePortalWatermark } from "@/components/dormspaces/dormspace-portal-watermark";

import { dormspacePortalNavVisibility } from "@/lib/dormspace-portal-chrome";

import type { DormspacePortalNavVariant } from "@/lib/dormspace-portal-nav";



type Props = {

  children: ReactNode;

  variant?: DormspacePortalNavVariant;

  activeLandlordTab?: "listings" | "inquiries" | "profile" | "account";

  minimalNav?: boolean;

  className?: string;

};



/** Shared dormspacers chrome: watermark + portal nav + content. */

export function DormspacePortalShell({

  children,

  variant,

  activeLandlordTab,

  minimalNav,

  className,

}: Props) {

  const pathname = usePathname() ?? "";

  const navVisibility = dormspacePortalNavVisibility(pathname);

  const showPortalFooter =
    pathname === "/dormspaces" ||
    pathname.startsWith("/dormspaces/liked") ||
    pathname.startsWith("/dormspaces/search");



  return (

    <div className={`relative flex min-h-screen flex-col bg-[#FAF8F4] ${className ?? ""}`}>

      <DormspacePortalWatermark />

      <div className={navVisibility === "desktop-only" ? "hidden md:block" : undefined}>
        <DormspacePortalNav
          variant={variant}
          activeLandlordTab={activeLandlordTab}
          minimal={minimalNav ?? navVisibility === "minimal"}
        />
      </div>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-x-clip overflow-y-visible">
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


