"use client";

import type { ReactNode } from "react";
import { Camera, Mail, MessageCircle, Phone } from "lucide-react";

import type { LandlordPublicProfile } from "@/lib/dormspace-landlord-profile";
import {
  landlordEmailHref,
  landlordPhoneTelHref,
  landlordSmsHref,
  landlordViberHref,
  landlordWhatsAppHref,
} from "@/lib/landlord-contact-links";
import { cn } from "@/lib/utils";

type Slot = {
  key: string;
  label: string;
  tooltip: string;
  href: string;
  glyph: ReactNode;
};

function ContactIconSlot({ slot }: { slot: Slot }) {
  return (
    <a
      href={slot.href}
      target={slot.href.startsWith("http") ? "_blank" : undefined}
      rel={slot.href.startsWith("http") ? "noopener noreferrer" : undefined}
      title={slot.tooltip}
      aria-label={slot.tooltip}
      className="group flex flex-col items-center gap-1"
    >
      <span
        className={cn(
          "flex size-8 items-center justify-center rounded-full border border-[#2C2C2C]/12 shadow-sm transition",
          "group-hover:scale-105 group-hover:border-[#6B9E6E]/40",
        )}
      >
        {slot.glyph}
      </span>
    </a>
  );
}

function WhatsAppGlyph() {
  return (
    <span className="flex size-8 items-center justify-center rounded-full bg-[#25D366] text-white shadow-sm">
      <MessageCircle className="size-4" aria-hidden strokeWidth={2.25} />
    </span>
  );
}

function ViberGlyph() {
  return (
    <span className="flex size-8 items-center justify-center rounded-full bg-[#7360F2] text-[15px] font-black leading-none text-white shadow-sm">
      V
    </span>
  );
}

function FacebookGlyph() {
  return (
    <span className="flex size-8 items-center justify-center rounded-full bg-[#1877F2] text-[15px] font-black leading-none text-white shadow-sm">
      f
    </span>
  );
}

function InstagramGlyph() {
  return (
    <span className="relative flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] shadow-sm">
      <Camera className="relative z-[1] size-4 stroke-[2.25] text-white" aria-hidden />
    </span>
  );
}

function PhoneGlyph() {
  return (
    <span className="flex size-8 items-center justify-center rounded-full bg-[#6B9E6E] text-white shadow-sm">
      <Phone className="size-4" aria-hidden strokeWidth={2.25} />
    </span>
  );
}

function SmsGlyph() {
  return (
    <span className="flex size-8 items-center justify-center rounded-full bg-[#6B9E6E]/90 text-white shadow-sm">
      <MessageCircle className="size-4" aria-hidden strokeWidth={2.25} />
    </span>
  );
}

function EmailGlyph() {
  return (
    <span className="flex size-8 items-center justify-center rounded-full bg-[#FAF8F4] shadow-sm ring-1 ring-[#2C2C2C]/12">
      <Mail className="size-4 text-[#6B9E6E]" aria-hidden strokeWidth={2.25} />
    </span>
  );
}

export function LandlordContactIconsRow({
  landlord,
  listingTitle,
  className,
}: {
  landlord: LandlordPublicProfile;
  listingTitle: string;
  className?: string;
}) {
  const phone = landlord.phone?.trim() || null;
  const viberNum = landlord.landlord_viber?.trim() || phone;
  const email = landlord.email?.trim() || null;
  const fb = landlord.landlord_facebook_url?.trim() || null;
  const ig = landlord.landlord_instagram_url?.trim() || null;

  const showPhone = landlord.landlord_show_phone !== false;
  const showWhatsApp = landlord.landlord_show_whatsapp !== false;
  const showViber = landlord.landlord_show_viber !== false;
  const showEmail = landlord.landlord_show_email !== false;
  const showFacebook = landlord.landlord_show_facebook !== false;
  const showInstagram = landlord.landlord_show_instagram !== false;

  const slots: Slot[] = [];

  if (showWhatsApp) {
    const href = landlordWhatsAppHref(phone, listingTitle);
    if (href) {
      slots.push({
        key: "whatsapp",
        label: "WhatsApp",
        tooltip: "Message on WhatsApp",
        href,
        glyph: <WhatsAppGlyph />,
      });
    }
  }

  if (showViber) {
    const href = landlordViberHref(viberNum);
    if (href) {
      slots.push({
        key: "viber",
        label: "Viber",
        tooltip: "Message on Viber",
        href,
        glyph: <ViberGlyph />,
      });
    }
  }

  if (showPhone) {
    const href = landlordPhoneTelHref(phone);
    if (href) {
      slots.push({
        key: "phone",
        label: "Call",
        tooltip: "Call landlord",
        href,
        glyph: <PhoneGlyph />,
      });
    }
  }

  if (showPhone) {
    const href = landlordSmsHref(phone, listingTitle);
    if (href) {
      slots.push({
        key: "sms",
        label: "SMS",
        tooltip: "Text landlord",
        href,
        glyph: <SmsGlyph />,
      });
    }
  }

  if (showEmail) {
    const href = landlordEmailHref(email, listingTitle);
    if (href) {
      slots.push({
        key: "email",
        label: "Email",
        tooltip: "Email landlord",
        href,
        glyph: <EmailGlyph />,
      });
    }
  }

  if (showFacebook && fb) {
    slots.push({
      key: "facebook",
      label: "Facebook",
      tooltip: "View on Facebook",
      href: fb,
      glyph: <FacebookGlyph />,
    });
  }

  if (showInstagram && ig) {
    slots.push({
      key: "instagram",
      label: "Instagram",
      tooltip: "View on Instagram",
      href: ig,
      glyph: <InstagramGlyph />,
    });
  }

  if (slots.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-3", className)}>
      {slots.map((slot) => (
        <ContactIconSlot key={slot.key} slot={slot} />
      ))}
    </div>
  );
}
