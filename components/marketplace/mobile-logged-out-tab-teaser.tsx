"use client";

import { useEffect, type CSSProperties, type ReactNode } from "react";
import Image from "next/image";
import { Bell, Heart, MapPin, MessageCircle, Share2 } from "lucide-react";

import { AuthSignInLinkForPath } from "@/components/auth/auth-sign-in-cta";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";
import { cn } from "@/lib/utils";

/** Full mobile design — title, chat mockup, listing card, benefit row (guest Messages tab). */
export const GUEST_MESSAGES_TEASER_IMAGE = "/marketing/mobile-guest-messages-teaser.png";

const MOBILE_BOTTOM_NAV_OFFSET = "calc(3.25rem + env(safe-area-inset-bottom, 0px))";

function useLockMobileDocumentScroll(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    const prevHtmlHeight = html.style.height;
    const prevBodyHeight = body.style.height;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    html.style.height = "100%";
    body.style.height = "100%";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
      html.style.height = prevHtmlHeight;
      body.style.height = prevBodyHeight;
    };
  }, [active]);
}

function TeaserBenefits({
  benefits,
}: {
  benefits: { icon: typeof MessageCircle; label: string }[];
}) {
  return (
    <ul className="grid shrink-0 grid-cols-3 gap-1.5 pb-1">
      {benefits.map(({ icon: Icon, label }) => (
        <li key={label} className="flex flex-col items-center gap-1 text-center">
          <span className="flex size-9 items-center justify-center rounded-full bg-[#6B9E6E]/12 ring-1 ring-[#6B9E6E]/15">
            <Icon className="size-4 text-[#6B9E6E]" strokeWidth={2} aria-hidden />
          </span>
          <span className="text-[9px] font-semibold leading-tight text-[#484848]">{label}</span>
        </li>
      ))}
    </ul>
  );
}

function TeaserShell({
  title,
  subtitle,
  nextPath,
  children,
  benefits,
  showSignInCta = true,
  lockScroll = false,
  fixedMobile = false,
}: {
  title: string;
  subtitle: string;
  nextPath: string;
  children: ReactNode;
  benefits: { icon: typeof MessageCircle; label: string }[];
  showSignInCta?: boolean;
  lockScroll?: boolean;
  fixedMobile?: boolean;
}) {
  useLockMobileDocumentScroll(lockScroll);

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden bg-[#FAF8F4]",
        fixedMobile
          ? "fixed inset-x-0 top-0 z-20 max-md:bottom-[var(--mobile-tab-offset)] max-md:max-h-[100dvh] md:relative md:inset-auto md:z-auto md:min-h-screen md:max-h-none"
          : "h-[100dvh] max-h-[100dvh] supports-[min-height:100dvh]:min-h-[100dvh] md:min-h-screen md:h-auto md:max-h-none",
      )}
      style={
        fixedMobile
          ? ({ "--mobile-tab-offset": MOBILE_BOTTOM_NAV_OFFSET } as CSSProperties)
          : undefined
      }
    >
      <MaddenTopNav compactMobileHome />
      <div
        className={cn(
          "mx-auto flex w-full max-w-lg min-h-0 flex-1 flex-col overflow-hidden px-4 pt-1",
          !fixedMobile && "pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))]",
          fixedMobile && "pb-1",
        )}
      >
        <header className="shrink-0 text-center">
          <h1 className="font-serif text-[1.6rem] font-semibold leading-tight tracking-tight text-[#2C2C2C]">
            {title}
          </h1>
          <p className="mt-1 text-[12px] font-medium leading-snug text-[#717171]">{subtitle}</p>
        </header>

        <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden">
          {children}
        </div>

        <TeaserBenefits benefits={benefits} />

        {showSignInCta ? (
          <AuthSignInLinkForPath nextPath={nextPath} className="mb-2 mt-1 w-full shrink-0" />
        ) : null}
      </div>
    </div>
  );
}

/** Guest Messages — entire screen body is the design PNG (no duplicate title/CTA/benefits). */
export function MobileLoggedOutMessagesTeaser() {
  useLockMobileDocumentScroll(true);

  return (
    <div
      className="fixed inset-x-0 top-0 z-20 flex max-md:max-h-[100dvh] flex-col overflow-hidden bg-[#FAF8F4] max-md:bottom-[var(--mobile-tab-offset)] md:relative md:inset-auto md:z-auto md:min-h-screen md:max-h-none"
      style={{ "--mobile-tab-offset": MOBILE_BOTTOM_NAV_OFFSET } as CSSProperties}
    >
      <MaddenTopNav compactMobileHome />
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-2 pt-0">
        <h1 className="sr-only">Messages</h1>
        <p className="sr-only">Sign in to message agents about listings.</p>
        <div className="relative min-h-0 w-full flex-1">
          <Image
            src={GUEST_MESSAGES_TEASER_IMAGE}
            alt=""
            fill
            className="object-contain object-center"
            sizes="(max-width: 767px) 100vw, 420px"
            priority
          />
        </div>
      </div>
    </div>
  );
}

function SavedHeroGraphic() {
  const thumbs = [
    "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=200&h=200&fit=crop",
    "https://images.unsplash.com/photo-1560448204-e02f11c45751?w=200&h=200&fit=crop",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=200&h=200&fit=crop",
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=200&h=200&fit=crop",
  ];

  return (
    <div className="relative mx-auto aspect-[4/5] w-full max-h-[min(52vh,17.5rem)] min-h-[13.5rem]">
      <div
        className="absolute left-1 top-[12%] z-0 w-[44%] -rotate-3 overflow-hidden rounded-xl border border-[#6B9E6E]/25 bg-gradient-to-br from-[#E8F0E9] to-[#FAF8F4] p-3 shadow-md"
        aria-hidden
      >
        <div className="grid grid-cols-4 gap-1 opacity-60">
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} className="aspect-square rounded-sm bg-[#6B9E6E]/25" />
          ))}
        </div>
        <MapPin className="absolute bottom-3 left-1/2 size-5 -translate-x-1/2 text-[#6B9E6E]/50" aria-hidden />
      </div>

      <div className="absolute inset-x-[5%] bottom-0 top-[5%] z-10 flex flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_12px_40px_rgba(44,44,44,0.12)]">
        <div className="flex shrink-0 items-center justify-between border-b border-black/[0.05] px-3 py-2.5">
          <p className="font-serif text-[15px] font-semibold text-[#2C2C2C]">Saved homes</p>
          <span className="flex size-7 items-center justify-center rounded-full bg-[#6B9E6E]/12">
            <Heart className="size-3.5 fill-[#6B9E6E] text-[#6B9E6E]" aria-hidden />
          </span>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-hidden p-3">
          {thumbs.map((src, i) => (
            <div
              key={src}
              className={cn(
                "relative overflow-hidden rounded-lg bg-[#E8E4DC] ring-1 ring-black/[0.05]",
                i === 0 && "col-span-2 aspect-[2/1]",
                i > 0 && "aspect-square",
              )}
            >
              <Image src={src} alt="" fill className="object-cover" sizes="140px" />
              {i === 0 ? (
                <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2 py-0.5 text-[9px] font-semibold text-[#2C2C2C] shadow-sm">
                  For Rent
                </span>
              ) : null}
            </div>
          ))}
        </div>

        <div className="shrink-0 border-t border-black/[0.05] px-3 py-2.5">
          <p className="text-[11px] font-semibold text-[#2C2C2C]">3 listings saved</p>
          <p className="text-[10px] text-[#717171]">Liked & bookmarked in one place</p>
        </div>
      </div>
    </div>
  );
}

export function MobileLoggedOutSavedTeaser() {
  return (
    <TeaserShell
      title="Saved"
      subtitle="Sign in to save and organize your favorite properties."
      nextPath="/saved"
      benefits={[
        { icon: Heart, label: "Keep track of homes you love" },
        { icon: Bell, label: "Get notified of price drops" },
        { icon: Share2, label: "Share favorites with family" },
      ]}
    >
      <SavedHeroGraphic />
    </TeaserShell>
  );
}

/** Desktop fallback — centered copy + sign in (scrollable ok on md+). */
export function DesktopLoggedOutTabEmpty({
  title,
  copy,
  nextPath,
}: {
  title: string;
  copy: string;
  nextPath: string;
}) {
  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      <MaddenTopNav />
      <div className="mx-auto max-w-lg px-4 py-10 pb-28 text-center">
        <h1 className="font-serif text-3xl font-bold tracking-tight text-[#2C2C2C]">{title}</h1>
        <p className="mt-3 text-sm font-medium leading-relaxed text-[#2C2C2C]/55">{copy}</p>
        <AuthSignInLinkForPath nextPath={nextPath} className="mt-6" />
      </div>
    </div>
  );
}
