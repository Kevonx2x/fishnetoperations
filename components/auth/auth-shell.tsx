import Link from "next/link";
import { BahayGoLogoLink } from "@/components/marketplace/bahaygo-logo";
import { BahayGoWordmark } from "@/components/marketplace/bahaygo-wordmark";

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Wider logo for login/signup (160px). */
  largeLogo?: boolean;
  /** Static BahayGo mark for auth pages that should not use the linked logo component. */
  staticBahayGoLogo?: boolean;
};

export function AuthShell({ title, subtitle, children, largeLogo, staticBahayGoLogo }: Props) {
  const logoWidth = largeLogo ? 160 : 120;
  return (
    <div className="min-h-screen bg-[#f7f6f3] flex flex-col">
      <header className="border-b border-black/5 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-center px-4">
          <Link href="/" className="text-sm font-medium text-gray-600 hover:text-gray-900">
            ← Home
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-black/8 bg-white p-8 shadow-sm">
          <div className="flex justify-center">
            {staticBahayGoLogo ? (
              <BahayGoWordmark size="login" className="mb-4 h-16 w-auto" />
            ) : (
              <BahayGoLogoLink priority width={logoWidth} />
            )}
          </div>
          <h1 className="mt-6 font-serif text-2xl font-medium text-gray-900">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-gray-500">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
