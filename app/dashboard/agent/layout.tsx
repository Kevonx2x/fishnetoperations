"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { AGENT_LEGACY_TAB_REDIRECTS } from "@/lib/agent-dashboard-routes";
import { StreamChatProvider } from "@/features/messaging/components/stream-chat-provider";

function AgentDashboardTabRedirect() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (pathname !== "/dashboard/agent") return;
    const tab = searchParams.get("tab");
    if (!tab) return;
    const mq = window.matchMedia("(min-width: 768px)");
    if (mq.matches) return;
    const channel = searchParams.get("channel");
    const editProperty = searchParams.get("editProperty");
    const target = AGENT_LEGACY_TAB_REDIRECTS[tab];
    if (!target || pathname === target) return;
    const sp = new URLSearchParams();
    if (channel) sp.set("channel", channel);
    if (editProperty) sp.set("editProperty", editProperty);
    const payment = searchParams.get("payment");
    const tier = searchParams.get("tier");
    if (payment) sp.set("payment", payment);
    if (tier) sp.set("tier", tier);
    const qs = sp.toString();
    router.replace(`${target}${qs ? `?${qs}` : ""}`);
  }, [pathname, searchParams, router]);

  return null;
}

export default function AgentDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <StreamChatProvider>
      <Suspense fallback={null}>
        <AgentDashboardTabRedirect />
      </Suspense>
      {children}
    </StreamChatProvider>
  );
}
