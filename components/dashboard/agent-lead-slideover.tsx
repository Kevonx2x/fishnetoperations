"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ImageIcon, Trash2, X } from "lucide-react";
import { SupabasePublicImage } from "@/components/supabase-public-image";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type LeadRow = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  property_interest: string | null;
  message: string | null;
  stage: string;
  created_at: string;
  property_cover_photo_url?: string | null;
};

type NoteRow = {
  id: string;
  note: string;
  created_at: string;
  agent_id: string;
};

export function AgentLeadSlideOver({
  lead,
  agentUserId,
  agentAvatarUrl,
  agentName,
  onClose,
}: {
  lead: LeadRow;
  agentUserId: string;
  agentAvatarUrl: string | null;
  agentName: string;
  onClose: () => void;
}) {
  const supabase = createSupabaseBrowserClient();
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadNotes = useCallback(async () => {
    const { data } = await supabase
      .from("lead_notes")
      .select("id, note, created_at, agent_id")
      .eq("lead_id", lead.id)
      .eq("agent_id", agentUserId)
      .order("created_at", { ascending: false });
    setNotes((data as NoteRow[]) ?? []);
    setLoading(false);
  }, [supabase, lead.id, agentUserId]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  const saveNote = async () => {
    const t = draft.trim();
    if (!t || t.length > 500) return;
    setSaving(true);
    const { error } = await supabase.from("lead_notes").insert({
      lead_id: lead.id,
      agent_id: agentUserId,
      note: t,
    });
    setSaving(false);
    if (error) {
      alert(error.message);
      return;
    }
    setDraft("");
    await loadNotes();
  };

  const deleteNote = async (id: string) => {
    if (!confirm("Delete this note?")) return;
    const { error } = await supabase.from("lead_notes").delete().eq("id", id).eq("agent_id", agentUserId);
    if (error) {
      alert(error.message);
      return;
    }
    await loadNotes();
  };

  const coverUrl = lead.property_cover_photo_url?.trim() || null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex justify-end bg-black/30"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: 320 }}
        animate={{ x: 0 }}
        exit={{ x: 320 }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        className="flex h-full w-full max-w-md flex-col overflow-hidden bg-[#FAF8F4] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
            <div className="border-b border-[#2C2C2C]/10 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-serif text-2xl font-bold text-[#2C2C2C]">{lead.name}</h2>
                  <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">{lead.email}</p>
                </div>
                <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-white" aria-label="Close">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <dl className="mt-6 space-y-3 text-sm">
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">Phone</dt>
                  <dd className="font-semibold text-[#2C2C2C]">{lead.phone ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">Property interest</dt>
                  <dd className="font-semibold text-[#2C2C2C]">{lead.property_interest ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">Message</dt>
                  <dd className="font-semibold text-[#2C2C2C]/80">{lead.message ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">Received</dt>
                  <dd className="font-semibold text-[#2C2C2C]">{new Date(lead.created_at).toLocaleString()}</dd>
                </div>
              </dl>
            </div>

            <div className="border-b border-[#2C2C2C]/10 px-6 pb-6 pt-4">
              <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-stone-200 bg-stone-100 shadow-sm">
                {coverUrl ? (
                  <SupabasePublicImage
                    src={coverUrl}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="(max-width: 28rem) 100vw, 28rem"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-stone-100">
                    <ImageIcon className="h-8 w-8 text-stone-300" strokeWidth={1.25} aria-hidden />
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 pb-6">
              <p className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">Notes</p>
              <div className="mt-3 min-h-[12rem]">
                {loading ? (
                  <p className="text-sm text-[#2C2C2C]/45">Loading…</p>
                ) : (
                  <ul className="space-y-3 border-l border-[#D4A843]/35 pl-4">
                    {notes.map((n) => (
                      <li key={n.id} className="relative">
                        <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-[#D4A843]" />
                        <div className="flex gap-2">
                          <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-black/10">
                            {agentAvatarUrl ? (
                              <SupabasePublicImage src={agentAvatarUrl} alt="" fill className="object-cover" sizes="32px" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-[#6B9E6E]/20 text-xs font-bold">
                                {agentName.slice(0, 1)}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-semibold text-[#2C2C2C]/45">
                              {new Date(n.created_at).toLocaleString()}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-[#2C2C2C]">{n.note}</p>
                            <button
                              type="button"
                              onClick={() => void deleteNote(n.id)}
                              className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:underline"
                            >
                              <Trash2 className="h-3 w-3" />
                              Delete
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                    {notes.length === 0 ? (
                      <li className="text-sm font-semibold text-[#2C2C2C]/45">No notes yet.</li>
                    ) : null}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="relative z-10 shrink-0 border-t border-[#2C2C2C]/10 bg-[#FAF8F4] p-6 shadow-[0_-10px_24px_rgba(44,44,44,0.06)]">
            <label className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">Add a note…</label>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 500))}
              rows={3}
              placeholder="Private note (max 500 characters)"
              className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
            />
            <div className="mt-2 flex items-center justify-between text-xs font-semibold text-[#2C2C2C]/45">
              <span>{draft.length}/500</span>
              <button
                type="button"
                disabled={saving || !draft.trim()}
                onClick={() => void saveNote()}
                className="rounded-full bg-[#6B9E6E] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save note"}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
