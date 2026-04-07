import Link from "next/link";
import { BahayGoLogoLink } from "@/components/marketplace/bahaygo-logo";

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function AuthShell({ title, subtitle, children }: Props) {
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
            <BahayGoLogoLink priority />
          </div>
          <h1 className="mt-6 font-serif text-2xl font-medium text-gray-900">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-gray-500">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
