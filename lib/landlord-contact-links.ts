import { digitsForChatApps, smsHref, viberHref } from "@/lib/agent-contact-links";

export type LandlordContactChannel =
  | "whatsapp"
  | "viber"
  | "phone"
  | "sms"
  | "email"
  | "facebook"
  | "instagram";

export function landlordInquiryMessage(listingTitle: string): string {
  const title = listingTitle.trim() || "this dormspace";
  return `Hi, I'm interested in your dormspace listing "${title}" on BahayGo.`;
}

export function landlordWhatsAppHref(
  phone: string | null | undefined,
  listingTitle: string,
): string | null {
  const d = digitsForChatApps(phone);
  if (!d) return null;
  const text = encodeURIComponent(landlordInquiryMessage(listingTitle));
  return `https://wa.me/${d}?text=${text}`;
}

export function landlordViberHref(viberOrPhone: string | null | undefined): string | null {
  return viberHref(viberOrPhone);
}

export function landlordPhoneTelHref(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  const cleaned = phone.replace(/\s/g, "");
  return `tel:${cleaned}`;
}

export function landlordSmsHref(
  phone: string | null | undefined,
  listingTitle: string,
): string | null {
  const base = smsHref(phone);
  if (!base) return null;
  const body = encodeURIComponent(landlordInquiryMessage(listingTitle));
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}body=${body}`;
}

export function landlordEmailHref(
  email: string | null | undefined,
  listingTitle: string,
): string | null {
  if (!email?.trim()) return null;
  const subject = encodeURIComponent(`Inquiry about ${listingTitle.trim() || "dormspace listing"}`);
  const body = encodeURIComponent(landlordInquiryMessage(listingTitle));
  return `mailto:${email.trim()}?subject=${subject}&body=${body}`;
}
