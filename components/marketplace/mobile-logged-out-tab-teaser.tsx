"use client";

import { useEffect, type CSSProperties } from "react";
import Image from "next/image";

import { AuthSignInLinkForPath } from "@/components/auth/auth-sign-in-cta";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";

/** Full mobile design — guest Messages tab (title, mockup, benefits). */
export const GUEST_MESSAGES_TEASER_IMAGE = "/marketing/mobile-guest-messages-teaser.png";

/** Full mobile design — guest Saved tab (title, saved homes card, benefits). */
export const GUEST_SAVED_TEASER_IMAGE = "/marketing/mobile-guest-saved-teaser.png";

import { MOBILE_BOTTOM_NAV_OFFSET_CSS } from "@/lib/mobile-bottom-nav-layout";

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

function MobileLoggedOutTabTeaserImage({
  imageSrc,
  title,
  subtitle,
}: {
  imageSrc: string;
  title: string;
  subtitle: string;
}) {
  useLockMobileDocumentScroll(true);

  return (
    <div
      className="fixed inset-x-0 top-0 z-20 flex max-md:max-h-[100dvh] flex-col overflow-hidden bg-[#FAF8F4] max-md:bottom-[var(--mobile-tab-offset)] md:relative md:inset-auto md:z-auto md:min-h-screen md:max-h-none"
      style={{ "--mobile-tab-offset": MOBILE_BOTTOM_NAV_OFFSET_CSS } as CSSProperties}
    >
      <MaddenTopNav compactMobileHome />
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-2 pt-0">
        <h1 className="sr-only">{title}</h1>
        <p className="sr-only">{subtitle}</p>
        <div className="relative min-h-0 w-full flex-1">
          <Image
            src={imageSrc}
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

export function MobileLoggedOutMessagesTeaser() {
  return (
    <MobileLoggedOutTabTeaserImage
      imageSrc={GUEST_MESSAGES_TEASER_IMAGE}
      title="Messages"
      subtitle="Sign in to message agents about listings."
    />
  );
}

export function MobileLoggedOutSavedTeaser() {
  return (
    <MobileLoggedOutTabTeaserImage
      imageSrc={GUEST_SAVED_TEASER_IMAGE}
      title="Saved"
      subtitle="Sign in to save and organize your favorite properties."
    />
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
