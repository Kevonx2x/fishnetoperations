/** Tab filter for mobile client activity feed (matches notifications.type). */
export type MobileFeedTab = "all" | "profile" | "saved" | "pins" | "documents";

export function notificationMatchesTab(type: string, tab: MobileFeedTab): boolean {
  if (tab === "all") {
    return (
      type.startsWith("client_feed_") ||
      type === "document_request" ||
      type === "document_shared" ||
      type === "viewing_confirmed" ||
      type === "viewing_declined" ||
      type === "verification" ||
      type === "verification_approved" ||
      type === "verification_rejected"
    );
  }
  if (tab === "profile") {
    return (
      type === "client_feed_badge" ||
      type === "verification" ||
      type === "verification_approved" ||
      type === "verification_rejected" ||
      type === "general"
    );
  }
  if (tab === "saved") {
    return type === "client_feed_property_save" || type === "client_feed_price_drop";
  }
  if (tab === "pins") {
    return type === "client_feed_property_like";
  }
  if (tab === "documents") {
    return type === "document_request" || type === "document_shared";
  }
  return false;
}

export function waMeUrl(phoneDigits: string, message: string): string {
  const d = phoneDigits.replace(/\D/g, "");
  if (!d) return "";
  const q = encodeURIComponent(message);
  return `https://wa.me/${d}?text=${q}`;
}
