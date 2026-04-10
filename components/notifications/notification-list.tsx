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
  const meta = n.metadata ?? null;
  const href = resolveNotificationLink(meta);
  const { Icon, className: iconClass } = notificationTypeIcon(n.type);
  const unread = !n.read_at;
  const documentSharedUrl =
    n.type === "document_shared" && meta && typeof meta.signed_url === "string" ? meta.signed_url : null;

  return (
    <div
      className={cn(
        "flex w-full gap-3 rounded-2xl bg-white px-4 py-4 shadow-sm transition hover:bg-[#FAF8F4]",
        unread
          ? "border border-[#2C2C2C]/10 border-l-[3px] border-l-[#6B9E6E]"
          : "border border-[#2C2C2C]/10 opacity-[0.92]",
      )}
    >
      <span className="mt-0.5 shrink-0">
        <Icon className={cn("h-5 w-5", iconClass)} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          className="w-full text-left"
          onClick={() => void onMarkRead(n, href)}
        >
          <span className="block font-bold text-[#2C2C2C]">{n.title}</span>
          {n.body ? (
            <span className="mt-1 line-clamp-3 block text-sm font-normal text-[#2C2C2C]/65">{n.body}</span>
          ) : null}
        </button>
        {documentSharedUrl ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void onMarkRead(n, "");
              window.open(documentSharedUrl, "_blank", "noopener,noreferrer");
            }}
            className="mt-2 rounded-full border border-[#6B9E6E] px-3 py-1 text-xs font-semibold text-[#6B9E6E] hover:bg-[#6B9E6E]/10"
          >
            View Document
          </button>
        ) : null}
      </div>
      <span className="shrink-0 self-start text-xs font-semibold tabular-nums text-[#2C2C2C]/45">
        {formatNotificationTimeAgo(n.created_at)}
      </span>
    </div>
  );
}
