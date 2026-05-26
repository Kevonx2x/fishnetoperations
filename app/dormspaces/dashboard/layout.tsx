"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const TAB_ROUTES: Record<string, string> = {
  listings: "/dormspaces/dashboard/listings",
  inquiries: "/dormspaces/dashboard/inquiries",
  profile: "/dormspaces/dashboard/profile",
  account: "/dormspaces/dashboard/account",
};

function DashboardTabRedirect() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (pathname !== "/dormspaces/dashboard") return;
    const tab = searchParams.get("tab");
    if (tab && TAB_ROUTES[tab]) {
      const welcome = searchParams.get("welcome");
      const q = welcome ? `?welcome=${welcome}` : "";
      router.replace(`${TAB_ROUTES[tab]}${q}`);
    }
  }, [pathname, searchParams, router]);

  return null;
}

export default function DormspaceDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <DashboardTabRedirect />
      </Suspense>
      {children}
    </>
  );
}
