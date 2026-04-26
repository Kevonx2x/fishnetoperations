import Link from "next/link";

export default function ClientDashboardOverviewPage() {
  return (
    <>
      <h1 className="font-serif text-3xl font-semibold tracking-tight text-[#2C2C2C] md:text-4xl">
        Overview
      </h1>
      <p className="mt-2 max-w-2xl text-sm font-medium text-[#888888] md:text-base">
        Welcome back. Here you&apos;ll soon see recent activity, upcoming viewings, and suggested
        listings. For now, open your pipeline to track deals or browse the marketplace from{" "}
        <span className="font-semibold text-[#2C2C2C]/70">Back to site</span>.
      </p>
      <div className="mt-8 grid max-w-2xl gap-4 sm:grid-cols-2">
        <Link
          href="/dashboard/client/pipeline"
          className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-5 shadow-sm transition hover:border-[#6B9E6E]/40"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-[#6B9E6E]">Pipeline</p>
          <p className="mt-2 font-serif text-lg font-semibold text-[#2C2C2C]">Track your deals</p>
          <p className="mt-1 text-sm text-[#888888]">Viewings, documents, and status per property.</p>
        </Link>
        <Link
          href="/"
          className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-5 shadow-sm transition hover:border-[#D4A843]/50"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-[#D4A843]">Marketplace</p>
          <p className="mt-2 font-serif text-lg font-semibold text-[#2C2C2C]">Browse listings</p>
          <p className="mt-1 text-sm text-[#888888]">Return to the main BahayGo site.</p>
        </Link>
      </div>
    </>
  );
}
