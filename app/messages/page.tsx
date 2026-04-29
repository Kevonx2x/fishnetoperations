"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";
import { ClientMessagesView } from "@/features/messaging/components/client-messages-view";
import { useAuth } from "@/contexts/auth-context";

function MessagesMain() {
  const searchParams = useSearchParams();
  const channel = searchParams.get("channel");

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ClientMessagesView initialChannelId={channel} />
    </div>
  );
}

export default function MessagesPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/auth/login?redirect=${encodeURIComponent("/messages")}`);
      return;
    }
    if (role !== "client") {
      router.replace("/");
    }
  }, [loading, user, role, router]);

  if (loading || !user || role !== "client") {
    return (
      <div className="flex min-h-screen flex-col bg-[#FAF8F4]">
        <MaddenTopNav />
        <div className="flex flex-1 items-center justify-center px-4 text-sm font-medium text-[#2C2C2C]/50">
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF8F4]">
      <MaddenTopNav />
      <main className="mx-auto flex w-full max-w-6xl min-h-0 flex-1 flex-col px-4 pb-6 pt-4">
        <Suspense
          fallback={
            <div className="flex min-h-[320px] flex-1 items-center justify-center rounded-2xl border border-[#2C2C2C]/10 bg-white text-sm text-[#2C2C2C]/50">
              Loading messages…
            </div>
          }
        >
          <MessagesMain />
        </Suspense>
      </main>
    </div>
  );
}
