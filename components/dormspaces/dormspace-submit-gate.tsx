"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "@/contexts/auth-context";

/**
 * Logged-out visitors must enter via /dormspaces/welcome unless they used
 * "Create a landlord account" (?from=welcome).
 */
export function DormspaceSubmitGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();

  const fromWelcome = searchParams.get("from") === "welcome";

  useEffect(() => {
    if (loading || fromWelcome || user) return;
    router.replace("/dormspaces/welcome");
  }, [loading, fromWelcome, user, router]);

  if (loading && !user) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <p className="text-sm font-medium text-[#484848]">Loading…</p>
      </div>
    );
  }

  if (!user && !fromWelcome) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <p className="text-sm font-medium text-[#484848]">Redirecting…</p>
      </div>
    );
  }

  return <>{children}</>;
}
