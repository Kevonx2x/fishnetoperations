"use client";

import type { ReactNode } from "react";

import { DormspacePortalFooter } from "@/components/dormspaces/dormspace-portal-footer";
import { DormspacePortalNav } from "@/components/dormspaces/dormspace-portal-nav";
import { DormspacePortalWatermark } from "@/components/dormspaces/dormspace-portal-watermark";
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
  return (
    <div className={`relative flex min-h-screen flex-col bg-[#FAF8F4] ${className ?? ""}`}>
      <DormspacePortalWatermark />
      <DormspacePortalNav variant={variant} activeLandlordTab={activeLandlordTab} minimal={minimalNav} />
      <div className="relative z-10 flex flex-1 flex-col">{children}</div>
      <DormspacePortalFooter />
    </div>
  );
}
