"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mail, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const PREBUILT: { id: string; title: string; body: string }[] = [
  { id: "p1", title: "Thank you for your inquiry", body: "Hi {{name}},\n\nThank you for reaching out about BahayGo. We received your inquiry and will get back to you shortly with next steps.\n\nBest regards" },
  { id: "p2", title: "Viewing confirmed", body: "Hi {{name}},\n\nThank you — your viewing is confirmed. I’ll meet you at the property at the scheduled time. If anything changes, reply to this email.\n\nBest regards" },
  { id: "p3", title: "Viewing reminder", body: "Hi {{name}},\n\nFriendly reminder: your viewing is coming up in 24 hours. Please arrive 5 minutes early.\n\nSee you soon!" },
  { id: "p4", title: "Property no longer available", body: "Hi {{name}},\n\nThank you for your interest. Unfortunately this listing is no longer available. I can share similar options that match what you’re looking for — would you like me to send a shortlist?\n\nBest regards" },
  { id: "p5", title: "Follow up — still interested?", body: "Hi {{name}},\n\nJust checking in — are you still interested in this property? I’m happy to answer questions or schedule a viewing.\n\nBest regards" },
  { id: "p6", title: "New similar property available", body: "Hi {{name}},\n\nA new listing just hit the market that matches your criteria. Would you like a quick summary and photos?\n\nBest regards" },
  { id: "p7", title: "Price reduced on property", body: "Hi {{name}},\n\nGood news — the price was updated on a property you viewed. Want to revisit the details or schedule a second viewing?\n\nBest regards" },
  { id: "p8", title: "Congratulations on your new home", body: "Hi {{name}},\n\nCongratulations on your new home! It was a pleasure helping you. If you need anything else, I’m here.\n\nWarm regards" },
  { id: "p9", title: "Request for more details", body: "Hi {{name}},\n\nThanks for your message. To help you better, could you share your preferred timeline and budget range?\n\nBest regards" },
  { id: "p10", title: "Schedule a call", body: "Hi {{name}},\n\nI’d love to schedule a quick call to understand your needs. What times work best for you this week?\n\nBest regards" },
];

type CustomRow = { id: string; title: string; body: string; created_at: string };

export function AgentLeadTemplatesSection({
  leadEmail,
  leadName,
}: {
  leadEmail?: string | null;
  leadName?: string | null;
}) {
  const { user } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [custom, setCustom] = useState<CustomRow[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [savingCustom, setSavingCustom] = useState(false);
  const [sending, setSending] = useState(false);

  const reloadCustom = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("agent_templates")
      .select("id, title, body, created_at")
      .eq("agent_id", user.id)
      .order("created_at", { ascending: false });
    setCustom((data as CustomRow[]) ?? []);
  };

  useEffect(() => {
    void reloadCustom();
  }, [supabase, user?.id]);

  const applyPlaceholders = (text: string) =>
    text.replace(/\{\{name\}\}/g, leadName?.trim() || "there");

  const openUse = (title: string, body: string) => {
    setDraftTitle(title);
    setEmailBody(applyPlaceholders(body));
    setEmailTo(leadEmail?.trim() || "");
    setModalOpen(true);
  };

  const openNewCustom = () => {
    setDraftTitle("My template");
    setEmailBody("");
    setEmailTo(leadEmail?.trim() || "");
    setModalOpen(true);
  };

  const saveCustomTemplate = async () => {
    if (!user?.id) return;
    const title = draftTitle.trim() || "Custom template";
    const body = emailBody.trim();
    if (!body) {
      toast.error("Add message text first.", { duration: 5000 });
      return;
    }
    setSavingCustom(true);
    const { error } = await supabase.from("agent_templates").insert({
      agent_id: user.id,
      title,
      body,
      is_default: false,
    });
    setSavingCustom(false);
    if (error) {
      toast.error(error.message, { duration: 5000 });
      return;
    }
    await reloadCustom();
    toast.success("Template saved");
  };

  const sendEmail = async () => {
    if (!emailTo.trim() || !emailBody.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/agent/lead-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          to: emailTo.trim(),
          subject: draftTitle.trim() || "Message from your BahayGo agent",
          html: `<div style="font-family:system-ui,sans-serif;line-height:1.5">${emailBody.replace(/\n/g, "<br/>")}</div>`,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: { message?: string } };
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not send email", { duration: 5000 });
        setSending(false);
        return;
      }
      toast.success("Email sent");
      setModalOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed", { duration: 5000 });
    }
    setSending(false);
  };

  return (
    <div className="mt-10 rounded-2xl border border-[#2C2C2C]/10 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl font-bold text-[#2C2C2C]">Response templates</h2>
          <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">{PREBUILT.length} quick replies + your saved templates</p>
        </div>
        <button
          type="button"
          onClick={openNewCustom}
          className="inline-flex items-center gap-2 rounded-full border border-[#D4A843]/40 bg-[#FAF8F4] px-4 py-2 text-xs font-bold text-[#8a6d32] hover:bg-[#D4A843]/15"
        >
          <Plus className="h-4 w-4" />
          New custom template
        </button>
      </div>
      {null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PREBUILT.map((t) => (
          <div
            key={t.id}
            className="flex flex-col rounded-2xl border border-[#2C2C2C]/10 bg-[#FAF8F4]/50 p-4 shadow-sm"
          >
            <p className="text-sm font-bold text-[#2C2C2C]">{t.title}</p>
            <p className="mt-2 line-clamp-3 text-xs font-semibold text-[#2C2C2C]/55">{t.body}</p>
            <button
              type="button"
              onClick={() => openUse(t.title, t.body)}
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-[#6B9E6E] px-4 py-2 text-xs font-bold text-white hover:bg-[#6f8d71]"
            >
              <Mail className="h-3.5 w-3.5" />
              Use
            </button>
          </div>
        ))}
        {custom.map((t) => (
          <div
            key={t.id}
            className="flex flex-col rounded-2xl border border-[#D4A843]/30 bg-white p-4 shadow-sm ring-1 ring-[#D4A843]/15"
          >
            <p className="text-sm font-bold text-[#2C2C2C]">{t.title}</p>
            <p className="mt-2 line-clamp-3 text-xs font-semibold text-[#2C2C2C]/55">{t.body}</p>
            <button
              type="button"
              onClick={() => openUse(t.title, t.body)}
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-[#6B9E6E] px-4 py-2 text-xs font-bold text-white hover:bg-[#6f8d71]"
            >
              <Mail className="h-3.5 w-3.5" />
              Use
            </button>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {modalOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-4 sm:items-center"
            onClick={() => setModalOpen(false)}
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#2C2C2C]/10 bg-[#FAF8F4] p-6 shadow-2xl"
            >
              <h3 className="font-serif text-lg font-bold text-[#2C2C2C]">Send email</h3>
              <label className="mt-4 block text-xs font-bold text-[#2C2C2C]/45">
                Client email
                <input
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
                />
              </label>
              <label className="mt-3 block text-xs font-bold text-[#2C2C2C]/45">
                Message
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={10}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
                />
              </label>
              {null}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void sendEmail()}
                  disabled={sending}
                  className="rounded-full bg-[#2C2C2C] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#6B9E6E] disabled:opacity-50"
                >
                  {sending ? "Sending…" : "Send"}
                </button>
                <button
                  type="button"
                  onClick={() => void saveCustomTemplate()}
                  disabled={savingCustom || !emailBody.trim()}
                  className="inline-flex items-center gap-2 rounded-full border border-[#D4A843]/40 bg-white px-4 py-2 text-sm font-bold text-[#8a6d32] disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {savingCustom ? "Saving…" : "Save as template"}
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-full px-4 py-2 text-sm font-bold text-[#2C2C2C]/55"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
