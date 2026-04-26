"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";

export default function ClientDashboardProfilePage() {
  const { user, loading } = useAuth();

  return (
    <>
      <h1 className="font-serif text-3xl font-semibold tracking-tight text-[#2C2C2C] md:text-4xl">
        Profile
      </h1>
      <p className="mt-2 max-w-2xl text-sm font-medium text-[#888888] md:text-base">
        Manage your account, saved properties, and preferences. Your public profile and activity
        feed stay on your BahayGo client page.
      </p>
      <ul className="mt-8 max-w-xl space-y-3">
        <li>
          <Link
            href="/settings"
            className="block rounded-2xl border border-[#2C2C2C]/10 bg-white px-5 py-4 text-sm font-semibold text-[#2C2C2C] shadow-sm transition hover:border-[#6B9E6E]/40"
          >
            Account &amp; settings →
            <span className="mt-1 block text-xs font-normal text-[#888888]">
              Profile details, notifications, and preferences
            </span>
          </Link>
        </li>
        <li>
          {loading || !user?.id ? (
            <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white px-5 py-4 text-sm text-[#888888]">
              Loading…
            </div>
          ) : (
            <Link
              href={`/clients/${encodeURIComponent(user.id)}`}
              className="block rounded-2xl border border-[#2C2C2C]/10 bg-white px-5 py-4 text-sm font-semibold text-[#2C2C2C] shadow-sm transition hover:border-[#6B9E6E]/40"
            >
              My profile &amp; saved properties →
              <span className="mt-1 block text-xs font-normal text-[#888888]">
                Activity feed, wishlist, and likes on your client page
              </span>
            </Link>
          )}
        </li>
      </ul>
    </>
  );
}
