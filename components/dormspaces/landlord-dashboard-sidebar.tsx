"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, MapPin, Plus, Settings, User } from "lucide-react";

import { useAuth } from "@/contexts/auth-context";
import { agentAvatarInitials } from "@/components/marketplace/agent-avatar";
import { landlordFirstName } from "@/components/dormspaces/landlord-dashboard-shell";
import { cn } from "@/lib/utils";

const SIDEBAR_LINK =
  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#484848] transition hover:bg-white/80 hover:text-[#2C2C2C]";

type NavItem = {
  href: string;
  label: string;
  icon: typeof MapPin;
  match: (path: string) => boolean;
  badge?: number;
};

type Props = {
  listingCount?: number;
  inquiryCount?: number;
  className?: string;
};

export function LandlordDashboardSidebar({
  listingCount = 0,
  inquiryCount = 0,
  className,
}: Props) {
  const pathname = usePathname() ?? "";
  const { user, profile } = useAuth();

  const displayName = profile?.full_name?.trim() || user?.email?.split("@")[0] || "Landlord";
  const firstName = landlordFirstName(profile?.full_name, user?.email);
  const initials = profile?.full_name?.trim()
    ? agentAvatarInitials(profile.full_name)
    : (user?.email?.[0] ?? "L").toUpperCase();

  const navItems: NavItem[] = [
    {
      href: "/dormspaces/dashboard/profile",
      label: "My Profile",
      icon: User,
      match: (p) => p.startsWith("/dormspaces/dashboard/profile"),
    },
    {
      href: "/dormspaces/dashboard/listings",
      label: "My Listings",
      icon: MapPin,
      match: (p) => p.startsWith("/dormspaces/dashboard/listings"),
      badge: listingCount > 0 ? listingCount : undefined,
    },
    {
      href: "/dormspaces/submit",
      label: "Add New Listing",
      icon: Plus,
      match: (p) => p.startsWith("/dormspaces/submit"),
    },
    {
      href: "/dormspaces/dashboard/inquiries",
      label: "Inquiries",
      icon: Inbox,
      match: (p) => p.startsWith("/dormspaces/dashboard/inquiries"),
      badge: inquiryCount > 0 ? inquiryCount : undefined,
    },
    {
      href: "/dormspaces/dashboard/account",
      label: "Account",
      icon: Settings,
      match: (p) => p.startsWith("/dormspaces/dashboard/account"),
    },
  ];

  return (
    <aside
      className={cn(
        "flex w-full shrink-0 flex-col border-r border-[#DDDDDD] bg-[#FAF8F4] md:w-[260px] lg:w-[280px]",
        className,
      )}
    >
      <div className="border-b border-[#DDDDDD] px-4 py-5">
        <div className="flex items-center gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#D4A843]/35 bg-white shadow-sm ring-2 ring-[#D4A843]/20">
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt="" className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center bg-[#6B9E6E] text-sm font-bold text-white">
                {initials}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate font-serif text-sm font-bold text-[#2C2C2C]">Hello, {firstName}</p>
            <p className="truncate text-xs font-medium text-[#888888]">{displayName}</p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-[#DDDDDD] bg-white p-3 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6B9E6E]">Your dormspaces</p>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-center">
            <div>
              <dt className="text-[10px] font-semibold uppercase text-[#888888]">Listings</dt>
              <dd className="font-serif text-lg font-bold text-[#2C2C2C]">{listingCount}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase text-[#888888]">Inquiries</dt>
              <dd className="font-serif text-lg font-bold text-[#D4A843]">{inquiryCount}</dd>
            </div>
          </dl>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-4" aria-label="Landlord dashboard">
        {navItems.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                SIDEBAR_LINK,
                active &&
                  "bg-white text-[#2C2C2C] shadow-sm ring-1 ring-[#6B9E6E]/25",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon
                className={cn("size-[18px] shrink-0", active ? "text-[#6B9E6E]" : "text-[#888888]")}
                aria-hidden
              />
              <span className="flex-1">{item.label}</span>
              {item.badge != null && item.badge > 0 ? (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#6B9E6E] px-1.5 text-[10px] font-bold text-white">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
