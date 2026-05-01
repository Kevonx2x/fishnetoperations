"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { fetchAgentViewings, type ParsedViewing } from "@/lib/viewings";

function addDays(d: Date, delta: number) {
  const out = new Date(d);
  out.setDate(out.getDate() + delta);
  return out;
}

function startOfWeekSunday(d: Date) {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() - out.getDay()); // Sun start
  return out;
}

/** Local calendar date as YYYY-MM-DD (never use UTC slice of toISOString for day bucketing). */
function localDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function statusClasses(statusRaw: string | null | undefined) {
  const status = String(statusRaw ?? "scheduled").toLowerCase();
  if (status === "completed") return "bg-[#D4A843]/[0.12] border-l-[#D4A843]";
  if (status === "cancelled") return "bg-[#888888]/[0.08] border-l-[#888888] opacity-40";
  return "bg-[#6B9E6E]/[0.12] border-l-[#6B9E6E]";
}

export function AgentCalendarModal(props: {
  open: boolean;
  onClose: () => void;
  supabase: SupabaseClient;
  agentId: string;
}) {
  const [cursor, setCursor] = useState<Date>(() => {
    const out = new Date();
    out.setHours(0, 0, 0, 0);
    return out;
  });
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<ParsedViewing[]>([]);
  const requestIdRef = useRef(0);

  const weekStart = useMemo(() => startOfWeekSunday(cursor), [cursor]);
  const weekDays = useMemo(() => Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i)), [weekStart]);

  const label = useMemo(
    () => cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
    [cursor],
  );

  useEffect(() => {
    if (!props.open) return;
    if (!props.agentId) {
      setEvents([]);
      return;
    }

    const reqId = (requestIdRef.current += 1);
    let cancelled = false;
    setLoading(true);

    const timeout = window.setTimeout(() => {
      if (cancelled) return;
      setLoading(false);
      setEvents([]);
    }, 3000);

    void (async () => {
      const rangeStart = new Date(weekStart);
      rangeStart.setHours(0, 0, 0, 0);
      const rangeEnd = addDays(rangeStart, 7);
      rangeEnd.setHours(0, 0, 0, 0);

      const mapped = await fetchAgentViewings(props.supabase, props.agentId, rangeStart, rangeEnd, {
        excludeCancelled: false,
      });

      if (cancelled || requestIdRef.current !== reqId) return;

      window.clearTimeout(timeout);
      setEvents(mapped);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [props.open, props.agentId, props.supabase, weekStart]);

  const todayKey = useMemo(() => localDateKey(new Date()), [props.open]);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const START_HOUR = 0;
  const END_HOUR = 23;
  const DEFAULT_SCROLL_HOUR = 8;
  const HOUR_ROW_PX = 56;
  const hours = useMemo(() => Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, i) => START_HOUR + i), []);
  const gridHeight = (END_HOUR - START_HOUR + 1) * HOUR_ROW_PX;
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const highlightKey = selectedDayKey ?? todayKey;

  useEffect(() => {
    if (!props.open) return;
    setSelectedDayKey(todayKey);
  }, [props.open, todayKey]);

  useEffect(() => {
    if (!props.open) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = DEFAULT_SCROLL_HOUR * HOUR_ROW_PX;
  }, [props.open, cursor]);

  return (
    <AnimatePresence>
      {props.open ? (
        <motion.div
          key="agent-calendar-overlay"
          className="fixed inset-0 z-[140] flex items-end justify-center px-4 py-6 md:items-center md:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.25 } }}
          transition={{ duration: 0.3 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-[rgba(44,44,44,0.70)] backdrop-blur-[2px]"
            aria-label="Close calendar"
            onClick={props.onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Calendar"
            className="relative z-10 w-full max-w-[1100px] min-h-[560px] overflow-hidden rounded-xl bg-white shadow-2xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={props.onClose}
              className="absolute right-4 top-4 rounded-md p-1.5 text-[#888888] transition hover:text-[#2C2C2C]"
              aria-label="Close"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>

            <div className="px-5 pt-4 pb-2">
              <div className="flex items-center gap-3 pr-10">
                <button
                  type="button"
                  onClick={() => setCursor((d) => addDays(d, -7))}
                  className="shrink-0 text-[#888888] hover:text-[#2C2C2C] transition"
                  aria-label="Previous week"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden />
                </button>
                <div className="flex-1 text-center text-lg font-semibold text-[#2C2C2C]">{label}</div>
                <button
                  type="button"
                  onClick={() => setCursor((d) => addDays(d, 7))}
                  className="shrink-0 text-[#888888] hover:text-[#2C2C2C] transition"
                  aria-label="Next week"
                >
                  <ChevronRight className="h-5 w-5" aria-hidden />
                </button>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    const t = new Date();
                    t.setHours(0, 0, 0, 0);
                    setCursor(t);
                  }}
                  className="text-xs text-[#6B9E6E] border border-[#6B9E6E]/30 rounded-full px-3 py-1 hover:bg-[#6B9E6E]/5 transition"
                >
                  Today
                </button>
              </div>
            </div>

            <div className="px-5 pb-4">
              {/* Weekly workspace */}
              <div className="grid grid-cols-[64px_1fr]">
                <div
                  ref={scrollRef}
                  className="col-span-2 max-h-[440px] overflow-y-auto"
                >
                  {/* Sticky header aligned with grid (shares scrollbar width) */}
                  <div className="sticky top-0 z-20 grid grid-cols-[64px_1fr] bg-white">
                    <div className="border-b border-gray-100" />
                    <div className="grid grid-cols-7 border-b border-gray-100">
                      {weekDays.map((d) => {
                        const k = localDateKey(d);
                        const isToday = k === todayKey;
                        const isHighlighted = k === highlightKey;
                        return (
                          <button
                            key={k}
                            type="button"
                            onClick={() => setSelectedDayKey(k)}
                            className={cn(
                              "text-left px-2.5 py-1.5 border-l border-gray-100 transition-colors",
                              isHighlighted && "bg-[#6B9E6E]/[0.04]",
                            )}
                          >
                            {isToday ? (
                              <div className="text-[10px] font-semibold text-[#6B9E6E] leading-none">Today</div>
                            ) : (
                              <div className="h-[10px]" aria-hidden />
                            )}
                            <div
                              className={cn(
                                "text-[11px] uppercase tracking-widest text-[#888888]/60",
                                isHighlighted && "text-[#2C2C2C] font-semibold",
                              )}
                            >
                              {d.toLocaleDateString(undefined, { weekday: "short" })}
                            </div>
                            <div className={cn("text-sm text-[#2C2C2C]", isHighlighted && "font-semibold")}>
                              {d.getDate()}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Scrollable body */}
                  <div className="grid grid-cols-[64px_1fr]">
                    <div className="border-r border-gray-100">
                      {hours.map((h) => (
                        <div
                          key={h}
                          className="pr-2 text-[11px] text-[#888888] text-right border-t border-gray-200"
                          style={{ height: HOUR_ROW_PX }}
                        >
                          {new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: "numeric" })}
                        </div>
                      ))}
                    </div>

                    <div className="relative">
                      <div className="grid grid-cols-7" style={{ height: gridHeight }}>
                        {weekDays.map((d) => {
                          const k = localDateKey(d);
                          const cellKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                          const dayEvents = events.filter((e) => e.dateKey === cellKey);
                          const isHighlighted = k === highlightKey;
                          return (
                            <button
                              key={k}
                              type="button"
                              onClick={() => setSelectedDayKey(k)}
                              className={cn(
                                "relative border-l border-gray-100 text-left",
                                isHighlighted && "bg-[#6B9E6E]/[0.02]",
                              )}
                            >
                              {/* Hour grid lines */}
                              {hours.map((h) => (
                                <div
                                  key={h}
                                  className="border-t border-gray-200"
                                  style={{ height: HOUR_ROW_PX }}
                                />
                              ))}

                              {/* Events */}
                              {dayEvents.map((v) => {
                                const dt = v.scheduledAt;
                                const mins = dt.getHours() * 60 + dt.getMinutes();
                                const startMins = START_HOUR * 60;
                                const endMins = END_HOUR * 60 + 60;
                                if (mins < startMins || mins >= endMins) return null;
                                const top = ((mins - startMins) / 60) * HOUR_ROW_PX + 2;
                                const height = HOUR_ROW_PX - 6;
                                const cls = statusClasses(v.status);
                                const cancelled = v.status === "cancelled";
                                return (
                                  <div
                                    key={v.id}
                                    className={cn(
                                      "absolute left-2 right-2 rounded-md px-2 py-1 border-l-[3px]",
                                      cls,
                                      cancelled && "line-through",
                                    )}
                                    style={{ top, height }}
                                  >
                                    <div className="text-[11px] font-semibold text-[#2C2C2C] truncate">
                                      {v.propertyName} · {v.timeLabel}
                                    </div>
                                  </div>
                                );
                              })}
                            </button>
                          );
                        })}
                      </div>

                      {loading ? (
                        <div className="pointer-events-none absolute inset-0 bg-white/50">
                          <div className="absolute inset-0 animate-pulse" />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
