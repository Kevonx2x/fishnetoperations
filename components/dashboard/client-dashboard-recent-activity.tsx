import Link from "next/link";
import {
  Award,
  Bell,
  Calendar,
  FileText,
  Heart,
  Home,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";

import type { NotificationListItem } from "@/components/notifications/notification-list";
import { viewingRequestNotificationDisplay } from "@/components/notifications/notification-list";
import { formatDashboardRelativeTimeManila } from "@/lib/dashboard-relative-time-manila";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function activityIconForType(type: string): LucideIcon {
  const t = type.toLowerCase();
  if (
    t === "viewing_request" ||
    t === "viewing_confirmed" ||
    t.startsWith("viewing_reschedule")
  ) {
    return Calendar;
  }
  if (t === "new_lead" || t === "lead_created" || t === "deal_pipeline") return Home;
  if (t === "document_request" || t === "document_shared" || t === "document_received") return FileText;
  if (t === "agent_message" || t === "message" || t === "client_reply") return MessageSquare;
  if (t === "client_feed_property_like" || t === "client_feed_property_save") return Heart;
  if (t === "client_feed_badge") return Award;
  return Bell;
}

function activityDisplayLine(n: NotificationListItem): string {
  if (n.type === "viewing_request") {
    const { body } = viewingRequestNotificationDisplay(n);
    return (body?.trim() || n.title).trim();
  }
  const b = n.body?.trim();
  if (b) return b;
  return n.title?.trim() || "";
}

function BodyWithOptionalBold({ text, actor }: { text: string; actor?: string | null }) {
  const a = actor?.trim();
  if (!a || !text) return <span className="text-sm leading-snug text-[#2C2C2C]/80">{text}</span>;
  const idx = text.indexOf(a);
  if (idx === -1) return <span className="text-sm leading-snug text-[#2C2C2C]/80">{text}</span>;
  return (
    <span className="text-sm leading-snug text-[#2C2C2C]/80">
      {text.slice(0, idx)}
      <strong className="font-semibold text-[#2C2C2C]">{a}</strong>
      {text.slice(idx + a.length)}
    </span>
  );
}

export default async function ClientDashboardRecentActivity(props: { userId: string }) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, created_at, type, title, body, read_at, metadata, dismissed_by_client, property_name")
    .eq("user_id", props.userId)
    .eq("dismissed_by_client", false)
    .order("created_at", { ascending: false })
    .limit(5);

  const rows = (error ? [] : (data ?? [])) as NotificationListItem[];

  return (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-[#2C2C2C]/[0.045] md:p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-serif text-lg font-semibold tracking-tight text-[#2C2C2C] md:text-xl">Recent Activity</h2>
        <Link href="/dashboard/client/notifications" className="shrink-0 text-sm font-semibold text-[#6B9E6E] hover:underline">
          View all
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="mt-5 text-center text-sm font-medium leading-relaxed text-[#2C2C2C]/55">
          No activity yet. Start by browsing properties or messaging an agent.
        </p>
      ) : (
        <ul className="mt-4 space-y-0 divide-y divide-[#2C2C2C]/[0.06]">
          {rows.map((n) => {
            const Icon = activityIconForType(n.type);
            const line = activityDisplayLine(n);
            const meta = (n.metadata ?? {}) as Record<string, unknown>;
            const actor = typeof meta.actor_name === "string" ? meta.actor_name.trim() : null;
            const unread = !n.read_at;
            return (
              <li key={n.id} className="flex gap-3 py-2.5 first:pt-0">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#6B9E6E]/10">
                  <Icon className="size-4 text-[#6B9E6E]" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <BodyWithOptionalBold text={line} actor={actor} />
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
                  <span className="text-xs font-medium tabular-nums text-[#2C2C2C]/45">
                    {formatDashboardRelativeTimeManila(n.created_at)}
                  </span>
                  {unread ? (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-[#6B9E6E]" aria-label="Unread" />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 border-t border-[#2C2C2C]/[0.06] pt-3 text-center">
        <Link href="/dashboard/client/notifications" className="text-sm font-semibold text-[#6B9E6E] hover:underline">
          View all activity
        </Link>
      </div>
    </section>
  );
}
