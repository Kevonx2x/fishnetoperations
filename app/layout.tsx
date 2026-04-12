import type { Metadata } from "next";
import { Inter, Playfair_Display, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";
import { Globe, Link2, Mail, MessageCircle } from "lucide-react";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BahayGo",
  description: "Luxury properties with verified agents and licensed brokers.",
  icons: { icon: "/favicon.ico", apple: "/apple-touch-icon.png" },
};

function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-[#2C2C2C]/10 bg-[#FAF8F4]">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="font-serif text-xl font-bold tracking-tight text-[#2C2C2C]">
              BahayGo
            </div>
            <div className="mt-0.5 text-[11px] font-semibold tracking-[0.18em] text-[#2C2C2C]/50">
              FIND YOUR HOME
            </div>
            <p className="mt-3 max-w-sm text-sm font-semibold text-[#2C2C2C]/55">
              Verified agents. Licensed brokers. Anti-scam protection.
            </p>
          </div>

          <div className="flex flex-col gap-6 sm:flex-row sm:gap-12">
            <div className="space-y-2 text-sm font-semibold text-[#2C2C2C]/70">
              <a className="block hover:text-[#2C2C2C]" href="/about">About</a>
              <a className="block hover:text-[#2C2C2C]" href="/pricing">Pricing</a>
              <a className="block hover:text-[#2C2C2C]" href="/blog">Blog</a>
              <a className="block hover:text-[#2C2C2C]" href="/contact">Contact</a>
            </div>
            <div className="space-y-2 text-sm font-semibold text-[#2C2C2C]/70">
              <a className="block hover:text-[#2C2C2C]" href="/privacy">Privacy</a>
              <a className="block hover:text-[#2C2C2C]" href="/terms">Terms</a>
              <a className="block hover:text-[#2C2C2C]" href="/anti-scam">Anti-scam</a>
              <a className="block hover:text-[#2C2C2C]" href="/saved">Saved</a>
            </div>
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#2C2C2C]/45">
                Support
              </p>
              <a
                className="block text-sm font-semibold text-[#2C2C2C]/70 hover:text-[#2C2C2C]"
                href="mailto:support@bahaygo.com"
              >
                support@bahaygo.com
              </a>
            </div>
          </div>

          <div className="flex items-center gap-3 text-[#2C2C2C]/55">
            <a className="rounded-full border border-black/10 bg-white p-2 hover:bg-[#FAF8F4]" href="#" aria-label="Website">
              <Globe className="h-4 w-4" />
            </a>
            <a className="rounded-full border border-black/10 bg-white p-2 hover:bg-[#FAF8F4]" href="#" aria-label="Share">
              <Link2 className="h-4 w-4" />
            </a>
            <a className="rounded-full border border-black/10 bg-white p-2 hover:bg-[#FAF8F4]" href="/contact" aria-label="Contact">
              <Mail className="h-4 w-4" />
            </a>
            <a className="rounded-full border border-black/10 bg-white p-2 hover:bg-[#FAF8F4]" href="/contact" aria-label="Support">
              <MessageCircle className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-[#2C2C2C]/10 pt-6 text-xs font-semibold text-[#2C2C2C]/50 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 BahayGo. All rights reserved.</span>
          <span>Safe discovery for luxury homes.</span>
        </div>
      </div>
    </footer>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link
          rel="preload"
          href="/_next/static/media/2a65768255d6b625-s.p.14by5b4al-y~f.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/_next/static/media/b49b0d9b851e4899-s.0yfy_qj1.2qn0.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>
          {children}
          <div className="min-h-[300px]">
            <SiteFooter />
          </div>
        </Providers>
      </body>
    </html>
  );
}
