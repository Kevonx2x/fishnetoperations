"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type GlobalAlertVariant = "success" | "error" | "warning";

const VARIANT_STYLES: Record<
  GlobalAlertVariant,
  { bar: string; border: string; icon: string }
> = {
  success: {
    bar: "bg-[#6B9E6E20]",
    border: "border-[#6B9E6E]/50",
    icon: "text-[#6B9E6E]",
  },
  warning: {
    bar: "bg-[#D4A843]/15",
    border: "border-[#D4A843]/45",
    icon: "text-[#D4A843]",
  },
  error: {
    bar: "bg-red-500/10",
    border: "border-red-500/40",
    icon: "text-red-600",
  },
};

export function GlobalAlertBanner({
  message,
  variant,
  onDismiss,
}: {
  message: string;
  variant: GlobalAlertVariant;
  onDismiss: () => void;
}) {
  const styles = VARIANT_STYLES[variant];
  const LeadIcon =
    variant === "error" ? AlertTriangle : variant === "warning" ? AlertTriangle : CheckCircle2;

  useEffect(() => {
    const t = window.setTimeout(() => onDismiss(), 5000);
    return () => window.clearTimeout(t);
  }, [message, variant, onDismiss]);

  return (
    <AnimatePresence>
      <motion.div
        role="status"
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -40, opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        className={cn(
          "fixed left-0 right-0 top-0 z-[999] flex items-center justify-center border-b px-3 py-2.5 shadow-sm sm:px-4",
          styles.bar,
          styles.border,
        )}
      >
        <div className="flex w-full max-w-4xl items-center gap-3">
          <LeadIcon className={cn("h-5 w-5 shrink-0", styles.icon)} aria-hidden />
          <p className="flex-1 text-center text-sm font-semibold text-[#2C2C2C]">{message}</p>
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded-lg p-1.5 text-[#2C2C2C]/50 transition hover:bg-black/5 hover:text-[#2C2C2C]"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
