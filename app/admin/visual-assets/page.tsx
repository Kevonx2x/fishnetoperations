"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { VisualAssetsManagement } from "@/components/admin/visual-assets-management";
import { useAuth } from "@/contexts/auth-context";
import { isAdminPanelRole } from "@/lib/auth-roles";

export default function VisualAssetsAdminPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user || !isAdminPanelRole(profile?.role)) {
      router.replace("/admin");
    }
  }, [loading, user, profile?.role, router]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-[#484848]">
        Loading…
      </div>
    );
  }

  if (!user || !isAdminPanelRole(profile?.role)) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      <div className="border-b border-[#2C2C2C]/10 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/admin" className="text-sm font-semibold text-[#6B9E6E] hover:underline">
            ← Back to admin
          </Link>
          <span className="text-xs font-semibold uppercase tracking-wide text-[#888888]">Admin</span>
        </div>
      </div>
      <VisualAssetsManagement />
    </div>
  );
}
