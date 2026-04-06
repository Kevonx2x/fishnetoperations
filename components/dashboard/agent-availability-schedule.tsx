"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import {
  type DaySchedule,
  type WeekdayKey,
  HOUR_OPTIONS,
  WEEKDAY_ORDER,
  compareStartEnd,
  mergeScheduleFromDb,
  toJsonPayload,
  formatHourLabel,
} from "@/lib/availability-schedule";

/** Start times 8:00–19:00 (end can be up to 20:00). */
const START_OPTIONS = HOUR_OPTIONS.slice(0, 12);

type BrowserSupabase = ReturnType<typeof import("@/lib/supabase/client").createSupabaseBrowserClient>;

type AgentAvailabilityProps = {
  agent: { availability_schedule?: unknown };
  supabase: BrowserSupabase;
  userId: string;
  onSaved: () => void | Promise<void>;
};

export function AgentAvailabilitySchedule({ agent, supabase, userId, onSaved }: AgentAvailabilityProps) {
  const [rows, setRows] = useState(() => mergeScheduleFromDb(agent.availability_schedule));
  const [saving, setSaving] = useState(false);

  const setDay = (key: WeekdayKey, patch: Partial<DaySchedule>) => {
    setRows((prev) => {
      const cur = prev[key];
      if (patch.enabled === false) {
        return { ...prev, [key]: { enabled: false } };
      }
      const merged = { ...cur, ...patch } as DaySchedule;
      if (merged.enabled === false) {
        return { ...prev, [key]: { enabled: false } };
      }
      const start = merged.start ?? "09:00";
      let end = merged.end ?? "17:00";
      if (!compareStartEnd(start, end)) {
        const ends = HOUR_OPTIONS.filter((h) => h > start);
        end = ends[0] ?? "20:00";
      }
      return { ...prev, [key]: { enabled: true, start, end } };
    });
  };

  const save = async () => {
    for (const { key } of WEEKDAY_ORDER) {
      const r = rows[key];
      if (!r.enabled) continue;
      const s = r.start ?? "09:00";
      const e = r.end ?? "17:00";
      if (!compareStartEnd(s, e)) {
        toast.error("Each enabled day needs an end time after the start time.");
        return;
      }
    }
    setSaving(true);
    const payload = toJsonPayload(rows);
    const { error } = await supabase.from("agents").update({ availability_schedule: payload }).eq("user_id", userId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Availability saved.");
    await onSaved();
  };

  return (
    <section className="mt-10 max-w-xl rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-sm">
      <h2 className="font-serif text-xl font-bold text-[#2C2C2C]">Availability schedule</h2>
      <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">
        Set the days and hours you accept viewing requests. Days turned off are blocked on your public booking calendar.
      </p>

      <div className="mt-6 space-y-3">
        {WEEKDAY_ORDER.map(({ key, label }) => {
          const r = rows[key];
          const on = r.enabled !== false;
          const start = r.start ?? "09:00";
          const end = r.end ?? "17:00";
          const endChoices = HOUR_OPTIONS.filter((h) => h > start);

          return (
            <div
              key={key}
              className={`flex flex-col gap-3 rounded-xl border border-[#2C2C2C]/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
                on ? "bg-[#FAF8F4]" : "bg-[#2C2C2C]/[0.04] opacity-70"
              }`}
            >
              <div className="flex items-center justify-between gap-3 sm:justify-start">
                <span className={`min-w-[100px] text-sm font-bold ${on ? "text-[#2C2C2C]" : "text-[#2C2C2C]/50"}`}>
                  {label}
                </span>
                <Switch
                  checked={on}
                  onCheckedChange={(checked) => setDay(key, { enabled: checked })}
                  className="data-checked:bg-[#6B9E6E] data-unchecked:bg-[#2C2C2C]/25"
                />
              </div>
              {on ? (
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={start}
                    onChange={(e) => setDay(key, { start: e.target.value })}
                    className="rounded-lg border border-[#2C2C2C]/15 bg-white px-2 py-1.5 text-sm font-semibold text-[#2C2C2C]"
                  >
                    {START_OPTIONS.map((h) => (
                      <option key={h} value={h}>
                        {formatHourLabel(h)}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs font-semibold text-[#2C2C2C]/45">to</span>
                  <select
                    value={endChoices.includes(end) ? end : endChoices[0]}
                    onChange={(e) => setDay(key, { end: e.target.value })}
                    className="rounded-lg border border-[#2C2C2C]/15 bg-white px-2 py-1.5 text-sm font-semibold text-[#2C2C2C]"
                  >
                    {endChoices.map((h) => (
                      <option key={h} value={h}>
                        {formatHourLabel(h)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="text-xs font-semibold text-[#2C2C2C]/40 sm:text-right">Unavailable</p>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="mt-6 w-full rounded-full border border-[#D4A843]/40 bg-[#D4A843]/15 py-3 text-sm font-bold text-[#2C2C2C] hover:bg-[#D4A843]/25 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save availability"}
      </button>
    </section>
  );
}
