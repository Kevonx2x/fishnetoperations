import Link from "next/link";
import { BahayGoLogoLink } from "@/components/marketplace/bahaygo-logo";
import { BahayGoWordmark } from "@/components/marketplace/bahaygo-wordmark";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Static BahayGo mark for auth pages that should not use the linked logo component. */
  staticBahayGoLogo?: boolean;
  /** Single-screen mobile layout for sign-in (no scroll, full-bleed cream). */
  compactMobile?: boolean;
};

export function AuthShell({
  title,
  subtitle,
  children,
  staticBahayGoLogo = true,
  compactMobile = false,
}: Props) {
  if (compactMobile) {
    return (
      <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-[#FAF8F4] md:min-h-screen md:h-auto md:max-h-none">
        <header className="shrink-0 border-b border-black/[0.06] bg-[#FAF8F4]/95 pt-[env(safe-area-inset-top,0px)] md:hidden">
          <div className="mx-auto flex h-12 max-w-lg items-center px-4">
            <Link href="/" className="text-sm font-medium text-[#484848] hover:text-[#2C2C2C]">
              ← Home
            </Link>
          </div>
        </header>
        <header className="hidden border-b border-black/5 bg-white/80 backdrop-blur-sm md:block">
          <div className="mx-auto flex h-14 max-w-lg items-center justify-center px-4">
            <Link href="/" className="text-sm font-medium text-gray-600 hover:text-gray-900">
              ← Home
            </Link>
          </div>
        </header>
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-4 md:items-center md:justify-center md:overflow-visible md:py-10">
          <div className="mx-auto flex w-full max-w-md min-h-0 flex-1 flex-col md:flex-none md:rounded-2xl md:border md:border-black/8 md:bg-white md:p-8 md:shadow-sm">
            <div className="flex shrink-0 justify-center">
              {staticBahayGoLogo ? (
                <BahayGoWordmark size="login" className="h-12 w-auto md:h-16" />
              ) : (
                <BahayGoLogoLink priority width={120} />
              )}
            </div>
            <h1 className="mt-4 shrink-0 text-center font-serif text-xl font-semibold leading-tight text-[#2C2C2C] md:mt-6 md:text-2xl">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-1 shrink-0 text-center text-[13px] leading-snug text-[#484848] md:mt-2 md:text-sm">
                {subtitle}
              </p>
            ) : null}
            <div className="mt-4 min-h-0 flex-1 overflow-hidden md:mt-8 md:overflow-visible">{children}</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF8F4]">
      <header className="border-b border-black/5 bg-[#FAF8F4]/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-center px-4">
          <Link href="/" className="text-sm font-medium text-gray-600 hover:text-gray-900">
            ← Home
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="flex justify-center">
            {staticBahayGoLogo ? (
              <BahayGoWordmark size="login" className={cn("mb-4 h-16 w-auto")} />
            ) : (
              <BahayGoLogoLink priority width={160} />
            )}
          </div>
          <h1 className="mt-6 text-center font-serif text-2xl font-medium text-gray-900">{title}</h1>
          {subtitle && <p className="mt-2 text-center text-sm text-[#484848]">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
