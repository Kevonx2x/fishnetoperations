/** Digits only, country code 63 for PH when missing. */
export function digitsForChatApps(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const d = raw.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("63")) return d;
  if (d.startsWith("0") && d.length >= 10) return `63${d.slice(1)}`;
  if (d.length === 10) return `63${d}`;
  return d;
}

export function whatsAppHref(phone: string | null | undefined): string | null {
  const d = digitsForChatApps(phone);
  if (!d) return null;
  return `https://wa.me/${d}`;
}

export function viberHref(phone: string | null | undefined): string | null {
  const d = digitsForChatApps(phone);
  if (!d) return null;
  return `viber://chat?number=${d}`;
}

export function smsHref(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  const cleaned = phone.replace(/\s/g, "");
  return `sms:${cleaned}`;
}
