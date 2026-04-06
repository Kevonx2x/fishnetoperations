"use client";

import { useMemo, useState } from "react";
import DatePicker from "react-datepicker";
import { Calendar } from "lucide-react";

type ViewingRow = {
  id: string;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  scheduled_at: string;
  status: string;
  property_id: string | null;
  notes: string | null;
  reminder_minutes?: number | null;
  reminder_sent?: boolean | null;
};

type PropertyMini = { id: string; location: string; name: string | null };

const TIME_SLOTS = [
  { label: "9:00 AM", h: 9, m: 0 },
  { label: "10:00 AM", h: 10, m: 0 },
  { label: "11:00 AM", h: 11, m: 0 },
  { label: "12:00 PM", h: 12, m: 0 },
  { label: "2:00 PM", h: 14, m: 0 },
  { label: "3:00 PM", h: 15, m: 0 },
  { label: "4:00 PM", h: 16, m: 0 },
  { label: "5:00 PM", h: 17, m: 0 },
];

const REMINDER_OPTIONS = [
  { label: "30 minutes before", value: 30 },
  { label: "1 hour before", value: 60 },
  { label: "2 hours before", value: 120 },
  { label: "1 day before", value: 1440 },
];

function applySlot(d: Date, slot: { h: number; m: number }): Date {
  const x = new Date(d);
  x.setHours(slot.h, slot.m, 0, 0);
  return x;
}

function nearestSlot(d: Date): (typeof TIME_SLOTS)[number] {
  const t = d.getHours() * 60 + d.getMinutes();
  let best = TIME_SLOTS[0];
  let bestDiff = Infinity;
  for (const s of TIME_SLOTS) {
    const st = s.h * 60 + s.m;
    const diff = Math.abs(st - t);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = s;
    }
  }
  return best;
}

export function AgentViewingsTab({
  viewings,
  properties,
  saving,
  onAfterAction,
}: {
  viewings: ViewingRow[];
  properties: PropertyMini[];
  saving: boolean;
  onAfterAction: () => Promise<void>;
}) {
  const propLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of properties) {
      m.set(p.id, p.name?.trim() || p.location);
    }
    return m;
  }, [properties]);

  const [busyId, setBusyId] = useState<string | null>(null);

  return (
    <div>
      <h1 className="font-serif text-3xl font-bold text-[#2C2C2C]">Viewings</h1>
      <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">Schedule, confirm, and send SMS &amp; email notifications.</p>
      <ul className="mt-6 space-y-6">
        {viewings.map((v) => (
          <ViewingCard
            key={v.id}
            v={v}
            propertyLabel={
              v.property_id ? (propLabel.get(v.property_id) ?? "Property") : "General viewing"
            }
            saving={saving || busyId === v.id}
            onBusy={(b) => setBusyId(b ? v.id : null)}
            onAfterAction={onAfterAction}
          />
        ))}
      </ul>
      {viewings.length === 0 ? (
        <p className="mt-6 text-sm font-semibold text-[#2C2C2C]/45">No viewing requests yet.</p>
      ) : null}
    </div>
  );
}

function ViewingCard({
  v,
  propertyLabel,
  saving,
  onBusy,
  onAfterAction,
}: {
  v: ViewingRow;
  propertyLabel: string;
  saving: boolean;
  onBusy: (b: boolean) => void;
  onAfterAction: () => Promise<void>;
}) {
  const initial = new Date(v.scheduled_at);
  const [date, setDate] = useState<Date>(initial);
  const [slot, setSlot] = useState(() => nearestSlot(initial));
  const [reminder, setReminder] = useState(v.reminder_minutes ?? 60);
  const [phone, setPhone] = useState(v.client_phone ?? "");

  const combined = useMemo(() => applySlot(date, slot), [date, slot]);

  const runAction = async (action: "confirm" | "decline") => {
    onBusy(true);
    try {
      const res = await fetch("/api/agent/viewing-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          viewingId: v.id,
          action,
          scheduledAt: combined.toISOString(),
          reminderMinutes: reminder,
          clientPhone: phone.trim() || null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: { message?: string } };
      if (!res.ok) {
        alert(json?.error?.message ?? "Request failed");
        return;
      }
      await onAfterAction();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    }
    onBusy(false);
  };

  return (
    <li className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start gap-2">
        <Calendar className="h-5 w-5 shrink-0 text-[#6B9E6E]" />
        <div>
          <p className="font-semibold text-[#2C2C2C]">{v.client_name}</p>
          <p className="text-xs font-semibold text-[#2C2C2C]/45">{v.client_email}</p>
          <p className="mt-1 text-sm font-bold text-[#D4A843]">{propertyLabel}</p>
        </div>
        <span className="ml-auto rounded-full bg-[#6B9E6E]/12 px-2 py-1 text-xs font-bold text-[#2C2C2C]/70">
          {v.status}
        </span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">Date</p>
          <DatePicker
            selected={date}
            onChange={(d) => d && setDate(d)}
            minDate={new Date()}
            className="mt-1 w-full rounded-xl border border-black/10 bg-[#FAF8F4] px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
            calendarClassName="rounded-xl border border-black/10 shadow-lg"
            dateFormat="MMM d, yyyy"
          />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">Time</p>
          <select
            value={`${slot.h}:${slot.m}`}
            onChange={(e) => {
              const [h, m] = e.target.value.split(":").map(Number);
              const found = TIME_SLOTS.find((s) => s.h === h && s.m === m);
              if (found) setSlot(found);
            }}
            className="mt-1 w-full rounded-xl border border-black/10 bg-[#FAF8F4] px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
          >
            {TIME_SLOTS.map((s) => (
              <option key={`${s.h}:${s.m}`} value={`${s.h}:${s.m}`}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">Reminder (SMS)</p>
          <select
            value={reminder}
            onChange={(e) => setReminder(Number(e.target.value))}
            className="mt-1 w-full rounded-xl border border-black/10 bg-[#FAF8F4] px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
          >
            {REMINDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">Client phone (SMS)</p>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+63…"
            className="mt-1 w-full rounded-xl border border-black/10 bg-[#FAF8F4] px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
          />
        </div>
      </div>
      <p className="mt-3 text-xs font-semibold text-[#2C2C2C]/45">
        Preview: {combined.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving || v.status === "confirmed"}
          onClick={() => void runAction("confirm")}
          className="rounded-full bg-[#6B9E6E] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
        >
          Confirm
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void runAction("decline")}
          className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-800 disabled:opacity-50"
        >
          Decline
        </button>
      </div>
    </li>
  );
}
