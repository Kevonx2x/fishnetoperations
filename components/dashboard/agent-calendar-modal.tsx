"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import { useAgentViewings } from "@/lib/agent-viewings-context";
import { cn } from "@/lib/utils";
import {
  manilaCalendarAddDays,
  manilaDateStringFromInstant,
  manilaDayOfMonthFromYmd,
  manilaMinutesSinceMidnightFromInstant,
  manilaWeekRangeLabel,
  manilaStartOfWeekSundayYmd,
  manilaTimeLabel12hFromInstant,
  manilaWeekdayShortFromYmd,
} from "@/lib/manila-datetime";
function statusClasses(statusRaw: string | null | undefined) {
  const status = String(statusRaw ?? "scheduled").toLowerCase();
  if (status === "completed") return "bg-[#D4A843]/[0.12] border-l-[#D4A843]";
  if (status === "cancelled") return "bg-[#888888]/[0.08] border-l-[#888888] opacity-40";
  return "bg-[#6B9E6E]/[0.12] border-l-[#6B9E6E]";
}

/** Hour tick label in Manila (12h). */
function manilaHourTickLabel(hour: number): string {
  const d = new Date(`2024-06-15T${String(hour).padStart(2, "0")}:00:00+08:00`);
  return manilaTimeLabel12hFromInstant(d);
}

export function AgentCalendarModal(props: { open: boolean; onClose: () => void }) {
  const { viewings: agentViewings, isLoading } = useAgentViewings();
  const [weekStartYmd, setWeekStartYmd] = useState(() =>
    manilaStartOfWeekSundayYmd(manilaDateStringFromInstant(new Date())),
  );

  const weekDayYmds = useMemo(
    () => Array.from({ length: 7 }, (_, i) => manilaCalendarAddDays(weekStartYmd, i)),
    [weekStartYmd],
  );

  const rangeEndExclusiveYmd = useMemo(() => manilaCalendarAddDays(weekStartYmd, 7), [weekStartYmd]);

  const events = useMemo(() => {
    return agentViewings
      .filter((v) => v.dateKey >= weekStartYmd && v.dateKey < rangeEndExclusiveYmd)
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  }, [agentViewings, weekStartYmd, rangeEndExclusiveYmd]);

  const monthTitle = useMemo(() => manilaWeekRangeLabel(weekStartYmd), [weekStartYmd]);

  useEffect(() => {
    if (!props.open) return;
    setWeekStartYmd(manilaStartOfWeekSundayYmd(manilaDateStringFromInstant(new Date())));
  }, [props.open]);

  const todayYmd = useMemo(() => manilaDateStringFromInstant(new Date()), [props.open, weekStartYmd]);
  const [selectedYmd, setSelectedYmd] = useState<string | null>(null);

  const START_HOUR = 0;
  const END_HOUR = 23;
  /** Shorter rows so 24h × 7 days fits in one view on most laptops. */
  const HOUR_ROW_PX = 26;
  const hours = useMemo(() => Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, i) => START_HOUR + i), []);
  const gridHeight = (END_HOUR - START_HOUR + 1) * HOUR_ROW_PX;

  const highlightYmd = selectedYmd ?? todayYmd;

  useEffect(() => {
    if (!props.open) return;
    setSelectedYmd(todayYmd);
  }, [props.open, todayYmd]);

  return (
    <AnimatePresence>
      {props.open ? (
        <motion.div
          key="agent-calendar-overlay"
          className="fixed inset-0 z-[140] flex items-end justify-center px-3 py-4 md:items-center md:p-6"
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
            className="relative z-10 flex max-h-[94vh] w-full max-w-[1180px] flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={props.onClose}
              className="absolute right-3 top-3 z-30 rounded-md p-1.5 text-[#888888] transition hover:text-[#2C2C2C] md:right-4 md:top-4"
              aria-label="Close"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>

            <div className="shrink-0 px-4 pt-3 pb-2 md:px-5 md:pt-4">
              <div className="flex items-center gap-3 pr-10">
                <button
                  type="button"
                  onClick={() => setWeekStartYmd((s) => manilaCalendarAddDays(s, -7))}
                  className="shrink-0 text-[#888888] transition hover:text-[#2C2C2C]"
                  aria-label="Previous week"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden />
                </button>
                <div className="flex-1 text-center">
                  <div className="text-lg font-semibold text-[#2C2C2C]">{monthTitle}</div>
                  <div className="mt-0.5 text-[11px] font-medium text-[#2C2C2C]/50">Times shown in Philippines (UTC+08:00)</div>
                </div>
                <button
                  type="button"
                  onClick={() => setWeekStartYmd((s) => manilaCalendarAddDays(s, 7))}
                  className="shrink-0 text-[#888888] transition hover:text-[#2C2C2C]"
                  aria-label="Next week"
                >
                  <ChevronRight className="h-5 w-5" aria-hidden />
                </button>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setWeekStartYmd(manilaStartOfWeekSundayYmd(manilaDateStringFromInstant(new Date())));
                  }}
                  className="rounded-full border border-[#6B9E6E]/30 px-3 py-1 text-xs font-semibold text-[#6B9E6E] transition hover:bg-[#6B9E6E]/5"
                >
                  Today
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto px-3 pb-4 md:px-5 md:pb-5">
              <div className="min-w-[720px]">
                <div className="sticky top-0 z-20 grid grid-cols-[52px_1fr] border-b border-gray-100 bg-white">
                  <div className="border-r border-gray-100" />
                  <div className="grid grid-cols-7">
                    {weekDayYmds.map((ymd, colIdx) => {
                      const isToday = ymd === todayYmd;
                      const isHighlighted = ymd === highlightYmd;
                      return (
                        <button
                          key={ymd}
                          type="button"
                          onClick={() => setSelectedYmd(ymd)}
                          className={cn(
                            "border-l border-gray-100 px-2 py-1.5 text-left transition-colors",
                            colIdx === 0 && "border-l-0",
                            isHighlighted && "bg-[#6B9E6E]/[0.06]",
                          )}
                        >
                          {isToday ? (
                            <div className="text-[10px] font-semibold leading-none text-[#6B9E6E]">Today</div>
                          ) : (
                            <div className="h-[10px]" aria-hidden />
                          )}
                          <div
                            className={cn(
                              "text-[10px] font-semibold uppercase tracking-widest text-[#888888]/70",
                              isHighlighted && "text-[#2C2C2C]",
                            )}
                          >
                            {manilaWeekdayShortFromYmd(ymd)}
                          </div>
                          <div className={cn("text-sm tabular-nums text-[#2C2C2C]", isHighlighted && "font-semibold")}>
                            {manilaDayOfMonthFromYmd(ymd)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-[52px_1fr]">
                  <div className="border-r border-gray-100">
                    {hours.map((h) => (
                      <div
                        key={h}
                        className="border-t border-gray-200 pr-1.5 text-right text-[10px] font-medium leading-none text-[#888888]"
                        style={{ height: HOUR_ROW_PX, paddingTop: 2 }}
                      >
                        {manilaHourTickLabel(h)}
                      </div>
                    ))}
                  </div>

                  <div className="relative min-w-0">
                    <div className="grid grid-cols-7" style={{ height: gridHeight }}>
                      {weekDayYmds.map((ymd, colIdx) => {
                        const dayEvents = events.filter((e) => e.dateKey === ymd);
                        const isHighlighted = ymd === highlightYmd;
                        return (
                          <button
                            key={ymd}
                            type="button"
                            onClick={() => setSelectedYmd(ymd)}
                            className={cn(
                              "relative border-l border-gray-100 text-left",
                              colIdx === 0 && "border-l-0",
                              isHighlighted && "bg-[#6B9E6E]/[0.02]",
                            )}
                          >
                            {hours.map((h) => (
                              <div key={h} className="border-t border-gray-200" style={{ height: HOUR_ROW_PX }} />
                            ))}

                            {dayEvents.map((v) => {
                              const mins = manilaMinutesSinceMidnightFromInstant(v.scheduledAt);
                              const startMins = START_HOUR * 60;
                              const endMins = END_HOUR * 60 + 60;
                              if (mins < startMins || mins >= endMins) return null;
                              const top = ((mins - startMins) / 60) * HOUR_ROW_PX + 1;
                              const height = Math.max(HOUR_ROW_PX - 4, 20);
                              const cls = statusClasses(v.status);
                              const cancelled = v.status === "cancelled";
                              return (
                                <div
                                  key={v.id}
                                  className={cn(
                                    "absolute left-0.5 right-0.5 min-w-0 overflow-hidden rounded border-l-[3px] px-1 py-0.5 md:left-1 md:right-1 md:px-1.5",
                                    cls,
                                    cancelled && "line-through",
                                  )}
                                  style={{ top, height }}
                                >
                                  <div className="min-w-0 text-[10px] font-semibold leading-tight text-[#2C2C2C] md:text-[11px]">
                                    <span className="block truncate whitespace-nowrap">{v.propertyName}</span>
                                    <span className="block truncate whitespace-nowrap text-[#2C2C2C]/75">{v.timeLabel}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </button>
                        );
                      })}
                    </div>

                    {isLoading ? (
                      <div className="pointer-events-none absolute inset-0 bg-white/50">
                        <div className="absolute inset-0 animate-pulse" />
                      </div>
                    ) : null}
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
