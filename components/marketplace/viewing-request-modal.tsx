"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { addDays, isBefore, setHours, setMinutes, startOfDay } from "date-fns";
import { X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { parseSchedule, viewingDateDisabled, type AvailabilitySchedule } from "@/lib/availability-schedule";

const TIME_SLOTS = [
  { label: "9:00 AM", hour: 9 },
  { label: "10:00 AM", hour: 10 },
  { label: "11:00 AM", hour: 11 },
  { label: "12:00 PM", hour: 12 },
  { label: "2:00 PM", hour: 14 },
  { label: "3:00 PM", hour: 15 },
  { label: "4:00 PM", hour: 16 },
  { label: "5:00 PM", hour: 17 },
] as const;

function toScheduledIso(date: Date, hour: number): string {
  const d0 = startOfDay(date);
  return setMinutes(setHours(d0, hour), 0).toISOString();
}

export function ViewingRequestModal({
  open,
  onOpenChange,
  propertyId,
  propertyTitle,
  agentUserId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When null (e.g. agent profile), request is not tied to a listing. */
  propertyId: string | null;
  propertyTitle: string;
  agentUserId: string | null;
}) {
  const { user, profile, loading: authLoading } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const titleId = useId();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState<Date | undefined>(() => startOfDay(new Date()));
  const [hour, setHour] = useState<number>(10);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notifyWarning, setNotifyWarning] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [agentSchedule, setAgentSchedule] = useState<AvailabilitySchedule | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setNotifyWarning(null);
    setSuccess(false);
    if (user) {
      setEmail(user.email ?? "");
      setName(profile?.full_name?.trim() ?? "");
      setPhone(profile?.phone?.trim() ?? "");
    }
    setDate(startOfDay(new Date()));
    setHour(10);
    setNotes("");
  }, [open, user, profile]);

  useEffect(() => {
    if (!open || !agentUserId) {
      setAgentSchedule(undefined);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.from("agents").select("availability_schedule").eq("user_id", agentUserId).maybeSingle();
      if (cancelled) return;
      setAgentSchedule(parseSchedule(data?.availability_schedule));
    })();
    return () => {
      cancelled = true;
    };
  }, [open, agentUserId, supabase]);

  useEffect(() => {
    if (!open || agentSchedule === undefined || !date) return;
    const today = new Date();
    if (viewingDateDisabled(date, agentSchedule, today)) {
      for (let i = 0; i < 400; i++) {
        const candidate = addDays(startOfDay(today), i);
        if (!viewingDateDisabled(candidate, agentSchedule, today)) {
          setDate(candidate);
          return;
        }
      }
    }
  }, [open, agentSchedule, date]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onOpenChange]);

  const submit = async () => {
    setError(null);
    setNotifyWarning(null);
    if (!user?.id) {
      setError("Please sign in to submit a viewing request.");
      return;
    }
    if (!agentUserId) {
      setError("No agent is available for this request yet.");
      return;
    }
    if (!name.trim() || !email.trim()) {
      setError("Please enter your name and email.");
      return;
    }
    if (!phone.trim()) {
      setError("Please enter your phone number.");
      return;
    }
    if (!date) {
      setError("Please choose a date.");
      return;
    }
    setBusy(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      console.log("[ViewingRequestModal] auth session for insert:", sessionData.session);
      if (!sessionData.session) {
        setError("Please sign in again");
        return;
      }

      const scheduledAt = toScheduledIso(date, hour);
      const { data: row, error: insErr } = await supabase
        .from("viewing_requests")
        .insert({
          agent_user_id: agentUserId,
          property_id: propertyId ?? null,
          client_user_id: user.id,
          client_name: name.trim(),
          client_email: email.trim(),
          client_phone: phone.trim(),
          scheduled_at: scheduledAt,
          notes: notes.trim() ? notes.trim() : null,
          status: "pending",
        })
        .select("id")
        .single();

      if (insErr) throw insErr;
      if (!row?.id) throw new Error("Could not create request.");

      const res = await fetch("/api/create-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ source: "viewing_request", viewingRequestId: row.id }),
      });

      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        setNotifyWarning(
          j?.error?.message ??
            "Your request was saved, but we could not notify the agent automatically.",
        );
      }

      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const shell = (
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-[121] flex max-h-[min(92dvh,720px)] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-[#2C2C2C]/10 bg-[#FAF8F4] shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#2C2C2C]/10 px-5 py-4">
          <div>
            <h2 id={titleId} className="font-serif text-xl font-bold text-[#2C2C2C]">
              Request a viewing
            </h2>
            <p className="mt-1 line-clamp-2 text-xs font-semibold text-[#2C2C2C]/55">{propertyTitle}</p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full p-2 text-[#2C2C2C]/60 transition hover:bg-[#2C2C2C]/10 hover:text-[#2C2C2C]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {authLoading ? (
            <p className="text-sm font-semibold text-[#2C2C2C]/60">Loading…</p>
          ) : !user ? (
            <p className="text-sm font-semibold text-[#2C2C2C]/60">Sign in to continue.</p>
          ) : success ? (
            <div className="rounded-2xl border border-[#6B9E6E]/25 bg-[#6B9E6E]/12 px-4 py-4">
              <p className="text-sm font-semibold text-[#2C2C2C]">
                Your viewing request has been sent! The agent will confirm shortly.
              </p>
              {notifyWarning ? (
                <p className="mt-2 text-xs font-semibold text-amber-800">{notifyWarning}</p>
              ) : null}
              <Button
                type="button"
                className="mt-4 w-full rounded-xl bg-[#D4A843] py-2.5 font-semibold text-[#2C2C2C] hover:brightness-95"
                onClick={() => {
                  setSuccess(false);
                  onOpenChange(false);
                }}
              >
                Done
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wide text-[#2C2C2C]/45">Name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[#2C2C2C]/15 bg-white px-3 py-2.5 text-sm font-semibold text-[#2C2C2C] outline-none ring-[#D4A843]/30 focus-visible:ring-2"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wide text-[#2C2C2C]/45">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[#2C2C2C]/15 bg-white px-3 py-2.5 text-sm font-semibold text-[#2C2C2C] outline-none ring-[#D4A843]/30 focus-visible:ring-2"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wide text-[#2C2C2C]/45">Phone</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[#2C2C2C]/15 bg-white px-3 py-2.5 text-sm font-semibold text-[#2C2C2C] outline-none ring-[#D4A843]/30 focus-visible:ring-2"
                  placeholder="+63…"
                />
              </label>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wide text-[#2C2C2C]/45">Preferred date</span>
                <div className="mt-2 flex justify-center rounded-xl border border-[#2C2C2C]/10 bg-white p-2">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => setDate(d ?? undefined)}
                    disabled={(d) => {
                      if (isBefore(startOfDay(d), startOfDay(new Date()))) return true;
                      if (agentSchedule !== undefined) {
                        return viewingDateDisabled(d, agentSchedule, new Date());
                      }
                      return false;
                    }}
                    className="mx-auto"
                  />
                </div>
              </div>

              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wide text-[#2C2C2C]/45">Time</span>
                <select
                  value={hour}
                  onChange={(e) => setHour(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-xl border border-[#2C2C2C]/15 bg-white px-3 py-2.5 text-sm font-semibold text-[#2C2C2C] outline-none ring-[#D4A843]/30 focus-visible:ring-2"
                >
                  {TIME_SLOTS.map((s) => (
                    <option key={s.hour} value={s.hour}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                  Message <span className="font-normal normal-case text-[#2C2C2C]/40">(optional)</span>
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="mt-1.5 w-full resize-none rounded-xl border border-[#2C2C2C]/15 bg-white px-3 py-2.5 text-sm font-semibold text-[#2C2C2C] outline-none ring-[#D4A843]/30 focus-visible:ring-2"
                  placeholder="Anything the agent should know?"
                />
              </label>

              {error ? (
                <div className="rounded-xl bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-800">{error}</div>
              ) : null}

              <Button
                type="button"
                disabled={busy || !agentUserId}
                className={cn(
                  "w-full rounded-xl py-3 font-semibold shadow-sm",
                  busy || !agentUserId
                    ? "cursor-not-allowed bg-[#2C2C2C]/20 text-[#2C2C2C]/50"
                    : "bg-[#2C2C2C] text-white hover:bg-[#6B9E6E]",
                )}
                onClick={() => void submit()}
              >
                {busy ? "Sending…" : "Submit request"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(shell, document.body);
}
