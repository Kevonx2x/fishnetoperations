import Link from "next/link";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";

const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy Policy", id: "privacy" as const },
  { href: "/terms", label: "Terms of Service", id: "terms" as const },
  { href: "/anti-scam", label: "Anti-Scam Policy", id: "anti-scam" as const },
];

export type LegalPageId = (typeof LEGAL_LINKS)[number]["id"];

export function LegalPageShell({
  title,
  eyebrow = "Legal",
  current,
  children,
}: {
  title: string;
  eyebrow?: string;
  current?: LegalPageId;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      <MaddenTopNav />
      <main className="mx-auto max-w-3xl px-4 py-10 pb-12">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2C2C2C]/55">
          {eyebrow}
        </p>
        <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight text-[#2C2C2C] md:text-4xl">
          {title}
        </h1>
        <p className="mt-3 text-sm font-medium text-[#2C2C2C]/55">Last updated: April 2026</p>

        <div className="mt-10 space-y-10 text-[15px] leading-relaxed text-[#2C2C2C]/90 [&_h2]:mt-0 [&_h2]:font-serif [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-[#2C2C2C] [&_h3]:mt-0 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-[#2C2C2C] [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_strong]:font-semibold [&_strong]:text-[#2C2C2C]">
          {children}
        </div>

        <nav
          className="mt-16 border-t border-[#2C2C2C]/10 pt-8"
          aria-label="Related legal documents"
        >
          <p className="font-serif text-lg font-semibold text-[#2C2C2C]">Other legal pages</p>
          <ul className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-8">
            {LEGAL_LINKS.filter((l) => l.id !== current).map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="text-sm font-semibold text-[#2C2C2C]/70 underline decoration-[#2C2C2C]/20 underline-offset-4 hover:text-[#2C2C2C] hover:decoration-[#2C2C2C]/40"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </main>
    </div>
  );
}
