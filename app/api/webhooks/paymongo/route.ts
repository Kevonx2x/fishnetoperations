import { NextResponse } from "next/server";
import { Resend } from "resend";
import { normalizeListingTier, TIER_LABEL } from "@/lib/agent-listing-limits";
import { RESEND_FROM } from "@/lib/resend-from";
import { parseSubscriptionRemarks, paymongoBasicAuthHeader } from "@/lib/paymongo";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/** Walk JSON for our PayMongo link `remarks` string. */
function findRemarksString(value: unknown): string | null {
  if (typeof value === "string") {
    if (value.includes("agent_id:") && value.includes("tier:")) {
      const p = parseSubscriptionRemarks(value);
      if (p) return value;
    }
    return null;
  }
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const v of value) {
      const f = findRemarksString(v);
      if (f) return f;
    }
    return null;
  }
  for (const v of Object.values(value as Record<string, unknown>)) {
    const f = findRemarksString(v);
    if (f) return f;
  }
  return null;
}

function getEventType(body: unknown): string | null {
  const attrs = (body as { data?: { attributes?: { type?: string } } })?.data?.attributes;
  const t = attrs?.type;
  return typeof t === "string" ? t : null;
}

function extractPaymentResource(body: unknown): { id: string; attributes: Record<string, unknown> } | null {
  const inner = (body as { data?: { attributes?: { data?: unknown } } })?.data?.attributes?.data;
  if (!inner || typeof inner !== "object") return null;
  const o = inner as { id?: unknown; type?: unknown; attributes?: unknown };
  if (typeof o.id !== "string" || o.type !== "payment") return null;
  const attrs = o.attributes && typeof o.attributes === "object" ? (o.attributes as Record<string, unknown>) : {};
  return { id: o.id, attributes: attrs };
}

function findPaymentIdInEvent(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const v of value) {
      const f = findPaymentIdInEvent(v);
      if (f) return f;
    }
    return null;
  }
  const o = value as Record<string, unknown>;
  if (o.type === "payment" && typeof o.id === "string" && o.id.startsWith("pay_")) {
    return o.id;
  }
  for (const v of Object.values(o)) {
    const f = findPaymentIdInEvent(v);
    if (f) return f;
  }
  return null;
}

async function paymongoGet(path: string): Promise<unknown | null> {
  if (!process.env.PAYMONGO_SECRET_KEY) return null;
  const res = await fetch(`https://api.paymongo.com/v1${path}`, {
    headers: { Authorization: paymongoBasicAuthHeader() },
  });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

async function resolveRemarks(body: unknown): Promise<string | null> {
  const inner = (body as { data?: { attributes?: { data?: unknown } } })?.data?.attributes?.data;
  if (inner && typeof inner === "object") {
    const o = inner as { type?: string; attributes?: { remarks?: string } };
    if (o.type === "link" && typeof o.attributes?.remarks === "string") {
      if (parseSubscriptionRemarks(o.attributes.remarks)) return o.attributes.remarks;
    }
  }

  const direct = findRemarksString(body);
  if (direct) return direct;

  const payFromEvent = extractPaymentResource(body);
  if (payFromEvent) {
    const paymentJson = await paymongoGet(`/payments/${payFromEvent.id}`);
    if (paymentJson) {
      const r = findRemarksString(paymentJson);
      if (r) return r;
      const linkId = extractLinkIdFromPaymentJson(paymentJson);
      if (linkId) {
        const fromLink = await fetchRemarksFromLink(linkId);
        if (fromLink) return fromLink;
      }
    }
    const piId = payFromEvent.attributes.payment_intent_id;
    if (typeof piId === "string") {
      const piJson = await paymongoGet(`/payment_intents/${piId}`);
      const r = piJson ? findRemarksString(piJson) : null;
      if (r) return r;
    }
  }

  const payId = findPaymentIdInEvent(body);
  if (payId) {
    const paymentJson = await paymongoGet(`/payments/${payId}`);
    if (paymentJson) {
      const r = findRemarksString(paymentJson);
      if (r) return r;
      const linkId = extractLinkIdFromPaymentJson(paymentJson);
      if (linkId) {
        return fetchRemarksFromLink(linkId);
      }
    }
  }

  return null;
}

function extractLinkIdFromPaymentJson(json: unknown): string | null {
  const d = json as {
    data?: {
      relationships?: { link?: { data?: { id?: string } } };
      attributes?: { metadata?: Record<string, string> };
    };
  };
  const id = d?.data?.relationships?.link?.data?.id;
  return typeof id === "string" ? id : null;
}

async function fetchRemarksFromLink(linkId: string): Promise<string | null> {
  const linkJson = await paymongoGet(`/links/${linkId}`);
  if (!linkJson) return null;
  const attrs = (linkJson as { data?: { attributes?: { remarks?: string } } })?.data?.attributes;
  const remarks = attrs?.remarks;
  if (typeof remarks === "string" && remarks.includes("agent_id:")) return remarks;
  return findRemarksString(linkJson);
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ received: false, error: "invalid_json" }, { status: 400 });
  }

  const eventType = getEventType(body);
  if (eventType !== "payment.paid" && eventType !== "link.payment.paid") {
    return NextResponse.json({ received: true, ignored: true, eventType });
  }

  const remarks = await resolveRemarks(body);

  if (!remarks) {
    console.warn("[paymongo/webhook] Could not resolve remarks for event", eventType);
    return NextResponse.json({ received: true, skipped: true, reason: "no_remarks" });
  }

  const parsed = parseSubscriptionRemarks(remarks);
  if (!parsed) {
    console.warn("[paymongo/webhook] Invalid remarks", remarks);
    return NextResponse.json({ received: true, skipped: true, reason: "bad_remarks" });
  }

  const { agentId, tier } = parsed;

  const payFromEvent = extractPaymentResource(body);
  let paymentId = payFromEvent?.id ?? findPaymentIdInEvent(body);
  let amount: number | null =
    typeof payFromEvent?.attributes.amount === "number"
      ? payFromEvent.attributes.amount
      : typeof payFromEvent?.attributes.amount === "string"
        ? Number(payFromEvent.attributes.amount)
        : null;

  if (!paymentId) {
    console.warn("[paymongo/webhook] Missing payment id");
    return NextResponse.json({ received: true, skipped: true, reason: "no_payment_id" });
  }

  if (amount === null || Number.isNaN(amount)) {
    const pj = await paymongoGet(`/payments/${paymentId}`);
    const a = (pj as { data?: { attributes?: { amount?: number } } })?.data?.attributes?.amount;
    amount = typeof a === "number" ? a : null;
  }

  const admin = createSupabaseAdmin();

  const { data: existing } = await admin
    .from("subscriptions")
    .select("id")
    .eq("paymongo_payment_id", paymentId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 1);

  let linkId: string | null = null;
  const paymentJson = await paymongoGet(`/payments/${paymentId}`);
  if (paymentJson) {
    linkId = extractLinkIdFromPaymentJson(paymentJson);
  }

  const { error: subErr } = await admin.from("subscriptions").insert({
    agent_id: agentId,
    tier,
    status: "active",
    paymongo_payment_id: paymentId,
    paymongo_link_id: linkId,
    amount: amount ?? undefined,
    currency: "PHP",
    expires_at: expiresAt.toISOString(),
  });

  if (subErr) {
    console.error("[paymongo/webhook] subscriptions insert:", subErr);
    return NextResponse.json({ received: false, error: subErr.message }, { status: 500 });
  }

  const { error: agentErr } = await admin.from("agents").update({ listing_tier: tier }).eq("id", agentId);

  if (agentErr) {
    console.error("[paymongo/webhook] agents update:", agentErr);
    return NextResponse.json({ received: false, error: agentErr.message }, { status: 500 });
  }

  const { data: agentRow } = await admin
    .from("agents")
    .select("user_id, email, name")
    .eq("id", agentId)
    .maybeSingle();

  const userId = agentRow?.user_id as string | undefined;
  const agentEmail = agentRow?.email as string | undefined;
  const agentName = (agentRow?.name as string | undefined) ?? "there";

  if (userId) {
    const label = TIER_LABEL[normalizeListingTier(tier)];
    const { error: notifErr } = await admin.from("notifications").insert({
      user_id: userId,
      type: "general",
      title: `🎉 Your BahayGo ${label} is now active!`,
      body: "Your subscription payment was received. Enjoy your upgraded limits and features.",
      metadata: { subscription_tier: tier, paymongo_payment_id: paymentId },
    });
    if (notifErr) {
      console.error("[paymongo/webhook] notification:", notifErr);
    }
  }

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  if (resend && agentEmail) {
    const label = TIER_LABEL[normalizeListingTier(tier)];
    const { error: emailErr } = await resend.emails.send({
      from: RESEND_FROM,
      to: agentEmail,
      subject: `BahayGo ${label} — subscription active`,
      html: `<p>Hi ${escapeHtml(agentName)},</p>
<p>Thank you! Your <strong>${escapeHtml(label)}</strong> monthly subscription is now active on BahayGo.</p>
<p>Amount: ₱${formatPhpFromCentavos(amount)}</p>
<p>You can manage your plan anytime from <a href="https://bahaygo.com/dashboard/agent?tab=billing">Billing</a> in your agent dashboard.</p>
<p>— BahayGo</p>`,
    });
    if (emailErr) {
      console.error("[paymongo/webhook] Resend:", emailErr);
    }
  }

  return NextResponse.json({ received: true });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatPhpFromCentavos(amount: number | null): string {
  if (amount === null || !Number.isFinite(amount)) return "—";
  return (amount / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
