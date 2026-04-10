"use client";

import {
  Bell,
  BadgeCheck,
  Clock,
  FileText,
  Heart,
  Home,
  Pin,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type NotificationListItem = {
  id: string;
  created_at: string;
  type: string;
  title: string;
  body: string | null;
  read_at: string | null;
  metadata?: Record<string, unknown> | null;
};

export function formatNotificationTimeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function notificationTypeIcon(type: string): { Icon: LucideIcon; className: string } {
  const t = type.toLowerCase();
  if (t.includes("verify") || t.includes("approved") || t.includes("license"))
    return { Icon: BadgeCheck, className: "text-[#6B9E6E]" };
  if (t.includes("like") || t.includes("heart")) return { Icon: Heart, className: "text-red-500" };
  if (t.includes("pin") || t.includes("save")) return { Icon: Pin, className: "text-[#D4A843]" };
  if (t === "property_match") return { Icon: Home, className: "text-[#6B9E6E]" };
  if (t === "lead_created" || t === "new_lead") return { Icon: Sparkles, className: "text-[#D4A843]" };
  if (t === "document_request" || t === "document_shared")
    return { Icon: FileText, className: "text-[#6B9E6E]" };
  if (t === "listing_expiry") return { Icon: Clock, className: "text-amber-600" };
  return { Icon: Bell, className: "text-[#2C2C2C]/50" };
}

export function resolveNotificationLink(metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata) return null;
  const link = metadata.link;
  if (typeof link === "string" && link.startsWith("/")) return link;
  const pid = metadata.property_id;
  if (typeof pid === "string") return `/properties/${pid}`;
  return null;
}

type NotificationCardProps = {
  n: NotificationListItem;
  onMarkRead: (n: NotificationListItem, navigateTo?: string | null) => void | Promise<void>;
};

export function NotificationCard({ n, onMarkRead }: NotificationCardProps) {
  const href = resolveNotificationLink(n.metadata ?? null);
  const { Icon, className: iconClass } = notificationTypeIcon(n.type);
  const unread = !n.read_at;

  return (
    <button
      type="button"
      onClick={() => void onMarkRead(n, href)}
      className={cn(
        "flex w-full gap-3 rounded-2xl bg-white px-4 py-4 text-left shadow-sm transition hover:bg-[#FAF8F4]",
        unread
          ? "border border-[#2C2C2C]/10 border-l-[3px] border-l-[#6B9E6E]"
          : "border border-[#2C2C2C]/10 opacity-[0.92]",
      )}
    >
      <span className="mt-0.5 shrink-0">
        <Icon className={cn("h-5 w-5", iconClass)} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold text-[#2C2C2C]">{n.title}</span>
        {n.body ? (
          <span className="mt-1 line-clamp-3 block text-sm font-normal text-[#2C2C2C]/65">{n.body}</span>
        ) : null}
      </span>
      <span className="shrink-0 text-xs font-semibold tabular-nums text-[#2C2C2C]/45">
        {formatNotificationTimeAgo(n.created_at)}
      </span>
    </button>
  );
}
