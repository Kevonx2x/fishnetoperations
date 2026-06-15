"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { PersonalBankAccountView } from "@/components/admin/personal-bank-account-view";
import { useAuth } from "@/contexts/auth-context";
import { canAccessPersonalTreasury } from "@/lib/admin-personal-treasury";

export default function AdminPersonalAccountPage() {
  const router = useRouter();
  const { user, profile, loading, status } = useAuth();
  const allowed = canAccessPersonalTreasury(user?.email, profile?.role);

  useEffect(() => {
    if (loading || status === "loading") return;
    if (status === "unauthenticated") {
      router.replace("/auth/login?next=/admin/personal-account");
      return;
    }
    if (!allowed) {
      router.replace("/admin");
    }
  }, [allowed, loading, router, status]);

  if (loading || status === "loading" || !allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f2f4f8]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#2d4a3e] border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <div className="md:hidden">
        <PersonalBankAccountView backHref="/more" backLabel="Account" />
      </div>

      <div className="hidden min-h-screen items-center justify-center bg-[#e8ebf0] p-8 md:flex">
        <div className="flex w-full max-w-5xl flex-col items-center gap-6">
          <div className="flex w-full max-w-md items-center justify-between px-1">
            <Link href="/admin" className="text-sm font-semibold text-[#2d4a3e] hover:underline">
              ← Admin
            </Link>
            <p className="text-sm font-semibold text-[#888888]">Personal account preview</p>
          </div>
          <div className="relative w-full max-w-[390px] overflow-hidden rounded-[2.25rem] border-[10px] border-[#1a1a1a] bg-[#1a1a1a] shadow-2xl">
            <div className="overflow-hidden rounded-[1.35rem]">
              <PersonalBankAccountView
                backHref="/admin"
                backLabel="Admin"
                className="min-h-[780px]"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
