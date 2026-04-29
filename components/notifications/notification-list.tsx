"use client";

import type { KeyboardEvent } from "react";
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
import { formatRelativeTime } from "@/lib/relative-time";

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
  return formatRelativeTime(iso);
}

function notificationTypeIcon(type: string): { Icon: LucideIcon; className: string } {
  const t = type.toLowerCase();
  if (t.includes("verify") || t.includes("approved") || t.includes("license"))
    return { Icon: BadgeCheck, className: "text-[#6B9E6E]" };
  if (t.includes("like") || t.includes("heart")) return { Icon: Heart, className: "text-red-500" };
  if (t.includes("pin") || t.includes("save")) return { Icon: Pin, className: "text-[#D4A843]" };
  if (t === "property_match") return { Icon: Home, className: "text-[#6B9E6E]" };
  if (t === "lead_created" || t === "new_lead") return { Icon: Sparkles, className: "text-[#D4A843]" };
  if (t === "document_request" || t === "document_shared" || t === "document_received")
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

/** Unread notifications of these types are counted for the agent dashboard Pipeline tab badge. */
export const AGENT_PIPELINE_TAB_NOTIFICATION_TYPES = ["new_lead", "document_received", "viewing_request"] as const;

/** Unread notifications of these types are counted for the client dashboard Pipeline tab badge. */
export const CLIENT_PIPELINE_TAB_NOTIFICATION_TYPES = [
  "document_request",
  "document_shared",
  "viewing_confirmed",
  "viewing_declined",
  "deal_pipeline",
  "client_feed_viewing",
] as const;

/** Action destinations for notification types (agent dashboard / settings). */
export function getNotificationClickHref(type: string): string | null {
  const t = type.toLowerCase();
  const map: Record<string, string> = {
    viewing_request: "/dashboard/agent?tab=pipeline",
    viewing_confirmed: "/dashboard/client?tab=pipeline",
    viewing_declined: "/dashboard/client?tab=pipeline",
    deal_pipeline: "/dashboard/client?tab=pipeline",
    document_request: "/dashboard/client?tab=pipeline",
    document_shared: "/dashboard/client?tab=pipeline",
    document_received: "/dashboard/agent?tab=pipeline",
    client_feed_viewing: "/dashboard/client?tab=pipeline",
    co_agent_request: "/dashboard/agent?tab=listings",
    verification: "/settings?tab=verification",
    listing_expiry: "/dashboard/agent?tab=listings",
  };
  return map[t] ?? null;
}

type NotificationCardProps = {
  n: NotificationListItem;
  onMarkRead: (n: NotificationListItem, navigateTo?: string | null) => void | Promise<void>;
  /** Extra right padding when a dismiss control is overlaid top-right (client notification center). */
  dismissGutter?: boolean;
};

export function NotificationCard({ n, onMarkRead, dismissGutter }: NotificationCardProps) {
  const meta = n.metadata ?? null;
  const metaLink =
    meta && typeof meta.link === "string" && meta.link.startsWith("/") ? meta.link : null;
  const clickHref = metaLink ?? getNotificationClickHref(n.type);
  const clickable = Boolean(clickHref);
  const { Icon, className: iconClass } = notificationTypeIcon(n.type);
  const unread = !n.read_at;
  const documentSharedUrl =
    n.type === "document_shared" && meta && typeof meta.signed_url === "string" ? meta.signed_url : null;

  const onCardActivate = () => {
    if (!clickable || !clickHref) return;
    void onMarkRead(n, clickHref);
  };

  return (
    <div
      className={cn(
        "flex w-full gap-3 rounded-2xl bg-white px-4 py-4 shadow-sm transition",
        dismissGutter && "pr-12",
        clickable ? "cursor-pointer hover:bg-gray-50" : "hover:bg-[#FAF8F4]",
        unread
          ? "border border-[#2C2C2C]/10 border-l-[3px] border-l-[#6B9E6E]"
          : "border border-[#2C2C2C]/10 opacity-[0.92]",
      )}
      {...(clickable
        ? {
            role: "button" as const,
            tabIndex: 0,
            onClick: onCardActivate,
            onKeyDown: (e: KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onCardActivate();
              }
            },
          }
        : {})}
    >
      <span className="mt-0.5 shrink-0">
        <Icon className={cn("h-5 w-5", iconClass)} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="w-full text-left">
          <span className="block font-bold text-[#2C2C2C]">{n.title}</span>
          {n.body ? (
            <span className="mt-1 line-clamp-3 block text-sm font-normal text-[#2C2C2C]/65">{n.body}</span>
          ) : null}
        </div>
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
      <div className="flex shrink-0 flex-col items-end gap-0.5 self-start">
        <span className="text-xs font-semibold tabular-nums text-[#2C2C2C]/45">
          {formatNotificationTimeAgo(n.created_at)}
        </span>
        {clickable ? (
          <span className="text-sm font-semibold text-[#2C2C2C]/45" aria-hidden>
            →
          </span>
        ) : null}
      </div>
    </div>
  );
}
