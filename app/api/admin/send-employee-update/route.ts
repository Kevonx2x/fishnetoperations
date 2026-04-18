import { NextResponse } from "next/server";
import { Resend } from "resend";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const ONBOARDING_EMAIL_SUFFIX = "@onboarding.bahaygo.internal";
const FROM = "BahayGo <ceo@bahaygo.com>";

type TmRow = {
  id: string;
  agent_id: string | null;
  email: string;
  name: string;
};

function isInternalEmployeeRow(m: TmRow): boolean {
  if (m.agent_id != null) return false;
  const em = (m.email ?? "").trim().toLowerCase();
  if (em.endsWith(ONBOARDING_EMAIL_SUFFIX)) return true;
  if (/emmanuel/i.test((m.name ?? "").trim())) return true;
  return false;
}

export async function POST(req: Request) {
  try {
    const denied = await requireAdminSession();
    if (denied === "unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const employeeId = typeof body.employee_id === "string" ? body.employee_id : "";
    const to = typeof body.to === "string" ? body.to.trim() : "";
    const ccRaw = typeof body.cc === "string" ? body.cc.trim() : "";
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const html = typeof body.html === "string" ? body.html.trim() : "";

    if (!employeeId || !to || !subject || !html) {
      return NextResponse.json({ error: "Missing employee_id, to, subject, or html." }, { status: 400 });
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: "Email is not configured (RESEND_API_KEY)." }, { status: 503 });
    }

    const admin = createSupabaseAdmin();
    const { data: tm, error: tmErr } = await admin
      .from("team_members")
      .select("id, agent_id, email, name, employment_status")
      .eq("id", employeeId)
      .maybeSingle();

    if (tmErr) {
      return NextResponse.json({ error: tmErr.message }, { status: 500 });
    }
    if (!tm || !isInternalEmployeeRow(tm as TmRow)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    if ((tm as { employment_status: string | null }).employment_status === "Terminated") {
      return NextResponse.json({ error: "Cannot send updates to a terminated employee." }, { status: 400 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const emailPayload: {
      from: string;
      to: string[];
      subject: string;
      html: string;
      cc?: string[];
    } = {
      from: FROM,
      to: [to],
      subject,
      html,
    };
    const ccList = ccRaw.split(",").map((s) => s.trim()).filter(Boolean);
    if (ccList.length > 0) {
      emailPayload.cc = ccList;
    }

    const { error: sendErr } = await resend.emails.send(emailPayload);
    if (sendErr) {
      return NextResponse.json({ error: sendErr.message ?? "Send failed" }, { status: 502 });
    }

    const { error: noteErr } = await admin.from("employee_notes").insert({
      employee_id: employeeId,
      note: "Progress update email sent.",
      created_by: denied.userId,
    });
    if (noteErr) {
      console.error("[send-employee-update] note log:", noteErr.message);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
