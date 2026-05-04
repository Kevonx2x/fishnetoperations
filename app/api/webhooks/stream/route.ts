import crypto from "node:crypto";

import { NextResponse } from "next/server";
import { Resend } from "resend";

import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { RESEND_FROM } from "@/lib/resend-from";
import { supportChannelIdForUser } from "@/lib/support-channel";

export const dynamic = "force-dynamic";

type StreamWebhookBody = {
  type?: string;
  cid?: string;
  message?: {
    id?: string;
    text?: string;
    user?: { id?: string; name?: string };
    user_id?: string;
  };
  channel?: {
    id?: string;
    type?: string;
    cid?: string;
    is_support?: boolean;
    data?: { is_support?: boolean; id?: string };
  };
};

function verifyStreamSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const sig = signature.trim().toLowerCase();
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(sig, "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function isSupportChannelFromPayload(ch: StreamWebhookBody["channel"], cid?: string): boolean {
  if (typeof cid === "string") {
    const parts = cid.split(":");
    const idPart = parts.length >= 2 ? parts[1] : cid;
    if (idPart?.startsWith("support_")) return true;
  }
  if (!ch) return false;
  if (ch.is_support === true) return true;
  const data = ch.data;
  if (data?.is_support === true) return true;
  const id = ch.id ?? data?.id;
  return typeof id === "string" && id.startsWith("support_");
}

function plainMessageText(message: StreamWebhookBody["message"]): string {
  if (!message) return "";
  const t = message.text?.trim();
  if (t) return t;
  return "[non-text message]";
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const secret = process.env.STREAM_API_SECRET?.trim();
  const apiKey = process.env.NEXT_PUBLIC_STREAM_API?.trim();
  const headerKey = req.headers.get("x-api-key")?.trim();
  const signature = req.headers.get("x-signature")?.trim() ?? null;

  if (!secret || !apiKey) {
    return NextResponse.json({ error: "Stream not configured" }, { status: 503 });
  }

  if (headerKey !== apiKey) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  if (!verifyStreamSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: StreamWebhookBody;
  try {
    body = JSON.parse(rawBody) as StreamWebhookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.type !== "message.new") {
    return NextResponse.json({ ok: true, ignored: body.type ?? "unknown" });
  }

  if (!isSupportChannelFromPayload(body.channel, body.cid)) {
    return NextResponse.json({ ok: true, ignored: "not_support_channel" });
  }

  const adminId = process.env.NEXT_PUBLIC_SUPPORT_ADMIN_USER_ID?.trim();
  if (!adminId) {
    return NextResponse.json({ ok: true, skipped: "no_admin_env" });
  }

  const senderId = body.message?.user?.id ?? body.message?.user_id ?? "";
  /* No Resend for support admin's own messages (e.g. automated welcome). */
  if (!senderId || senderId === adminId) {
    return NextResponse.json({ ok: true, skipped: "admin_or_anonymous" });
  }

  const to = process.env.SUPPORT_NOTIFICATION_EMAIL?.trim();
  if (!to || !process.env.RESEND_API_KEY) {
    console.warn("[webhooks/stream] SUPPORT_NOTIFICATION_EMAIL or RESEND_API_KEY missing; skip email");
    return NextResponse.json({ ok: true, skipped: "no_email_config" });
  }

  const sb = createSupabaseAdmin();
  const { data: profile } = await sb.from("profiles").select("full_name, role").eq("id", senderId).maybeSingle();

  let email = "";
  try {
    const { data: authUser } = await sb.auth.admin.getUserById(senderId);
    email = authUser.user?.email?.trim() ?? "";
  } catch {
    /* ignore */
  }

  const fullName =
    (profile?.full_name as string | null | undefined)?.trim() || body.message?.user?.name?.trim() || "Unknown";
  const role = (profile?.role as string | null | undefined)?.trim() || "unknown";
  const roleLabel = role === "client" ? "client" : role === "agent" ? "agent" : role;

  const messageText = plainMessageText(body.message);
  const subject = `[BahayGo Support] New message from ${fullName}`;

  const text = [
    `From: ${fullName} (${email || "no email on profile"}) — Role: ${roleLabel}`,
    "",
    `Message: ${messageText}`,
    "",
    "Reply by signing in as admin and opening their support channel.",
    "",
    `https://bahaygo.com/admin/support/${senderId}`,
  ].join("\n");

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: RESEND_FROM,
    to: [to],
    subject,
    text,
  });

  if (error) {
    console.error("[webhooks/stream] Resend:", error);
    return NextResponse.json({ error: "Email send failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, channelId: body.channel?.id ?? supportChannelIdForUser(senderId) });
}
