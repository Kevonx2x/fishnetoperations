"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Bed,
  ChevronRight,
  MessageSquare,
  Plus,
  Settings,
  User,
  type LucideIcon,
} from "lucide-react";

import {
  LandlordDashboardShell,
  landlordFirstName,
} from "@/components/dormspaces/landlord-dashboard-shell";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

type HubCardProps = {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  count?: number;
};

function HubCard({ href, icon: Icon, title, description, count }: HubCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex min-h-[104px] flex-col rounded-xl border border-black/[0.08] bg-white p-4",
        "shadow-[0_4px_20px_rgba(44,44,44,0.1)] ring-1 ring-white/80",
        "transition-all duration-200 ease-out",
        "hover:-translate-y-0.5 hover:border-[#6B9E6E]/20 hover:shadow-[0_10px_32px_rgba(107,158,110,0.18)]",
        "active:translate-y-0 active:shadow-[0_2px_12px_rgba(44,44,44,0.08)]",
      )}
    >
      {count != null && count > 0 ? (
        <span className="absolute right-3 top-3 z-10 flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-[#6B9E6E] px-1.5 text-[11px] font-bold text-white shadow-sm">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
      <div className="flex items-start justify-between gap-2">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#6B9E6E]/12 ring-1 ring-[#6B9E6E]/15 transition-colors group-hover:bg-[#6B9E6E]/18">
          <Icon className="h-6 w-6 text-[#6B9E6E]" strokeWidth={2} aria-hidden />
        </span>
        <ChevronRight
          className="mt-0.5 h-5 w-5 shrink-0 text-[#888888]/70 transition-transform group-hover:translate-x-0.5 group-hover:text-[#6B9E6E]"
          aria-hidden
        />
      </div>
      <p className="mt-3 text-base font-semibold text-[#2C2C2C]">{title}</p>
      <p className="mt-0.5 text-xs leading-snug text-[#888888]">{description}</p>
    </Link>
  );
}

export function LandlordDashboardHub() {
  const { user, profile } = useAuth();
  const [listingCount, setListingCount] = useState(0);
  const [inquiryCount, setInquiryCount] = useState(0);

  const loadCounts = useCallback(async () => {
    try {
      const [listingsRes, inquiriesRes] = await Promise.all([
        fetch("/api/dormspaces/landlord/listings", { credentials: "include" }),
        fetch("/api/dormspaces/landlord/inquiries?status=new", { credentials: "include" }),
      ]);
      const listingsJson = (await listingsRes.json()) as {
        data?: { items?: unknown[] };
      };
      const inquiriesJson = (await inquiriesRes.json()) as {
        data?: { items?: unknown[] };
      };
      if (listingsRes.ok) {
        setListingCount(listingsJson.data?.items?.length ?? 0);
      }
      if (inquiriesRes.ok) {
        setInquiryCount(inquiriesJson.data?.items?.length ?? 0);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadCounts();
  }, [loadCounts]);

  const firstName = landlordFirstName(profile?.full_name, user?.email);

  return (
    <LandlordDashboardShell variant="hub">
      <div className="px-4 py-6 pb-32 md:px-8 md:py-8">
        <h1 className="font-serif text-2xl font-bold text-[#2C2C2C] md:text-3xl">Dashboard</h1>
        <p className="mt-1 text-sm text-[#888888]">Welcome back, {firstName}</p>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <HubCard
            href="/dormspaces/dashboard/listings"
            icon={Bed}
            title="My Listings"
            description="Manage your dormspace listings"
            count={listingCount}
          />
          <HubCard
            href="/dormspaces/dashboard/inquiries"
            icon={MessageSquare}
            title="Inquiries"
            description="Messages from interested tenants"
            count={inquiryCount}
          />
          <HubCard
            href="/dormspaces/dashboard/profile"
            icon={User}
            title="My Profile"
            description="Edit your landlord profile and contact info"
          />
          <HubCard
            href="/dormspaces/dashboard/account"
            icon={Settings}
            title="Account"
            description="Settings, billing, sign out"
          />
        </div>

        <div className="mt-4">
          <Link
            href="/dormspaces/submit"
            className={cn(
              "inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#6B9E6E] px-4 text-base font-semibold text-white",
              "shadow-[0_6px_20px_rgba(107,158,110,0.35)]",
              "transition-all duration-200 hover:bg-[#5d8a60] hover:shadow-[0_8px_24px_rgba(107,158,110,0.42)] active:bg-[#527a55] active:shadow-[0_3px_12px_rgba(107,158,110,0.28)]",
            )}
          >
            <Plus className="h-5 w-5 shrink-0" aria-hidden />
            Add new dormspace
          </Link>
        </div>
      </div>
    </LandlordDashboardShell>
  );
}
