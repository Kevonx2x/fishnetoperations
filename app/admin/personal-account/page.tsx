"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { PersonalBankAccountDesktop } from "@/components/admin/personal-bank-account-desktop";
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
      <div className="flex min-h-screen items-center justify-center bg-[#f2f4f8] md:bg-[#eef1f6]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#2d4a3e] border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <div className="md:hidden">
        <PersonalBankAccountView backHref="/more" backLabel="Account" />
      </div>
      <div className="hidden md:block">
        <PersonalBankAccountDesktop />
      </div>
    </>
  );
}
