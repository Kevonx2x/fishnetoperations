"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export function ListingLimitUpgradeModal({
  onClose,
  isProTier,
  listingLimit,
}: {
  onClose: () => void;
  isProTier: boolean;
  listingLimit: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-4 sm:items-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 32, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-[#D4A843]/35 bg-[#FAF8F4] p-6 shadow-2xl"
      >
        <h2 className="font-serif text-xl font-bold text-[#2C2C2C]">
          {isProTier
            ? `You've reached your plan limit of ${listingLimit} listings`
            : "You've reached your free limit of 3 listings"}
        </h2>
        {isProTier ? (
          <p className="mt-3 text-sm font-semibold leading-relaxed text-[#2C2C2C]/70">
            Remove or archive a listing before adding another, or contact support if you need a higher limit.
          </p>
        ) : (
          <p className="mt-3 text-sm font-semibold leading-relaxed text-[#2C2C2C]/70">
            Upgrade to Pro for ₱999/month to list up to 20 properties.
          </p>
        )}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="order-2 rounded-full border border-[#2C2C2C]/15 bg-white px-5 py-2.5 text-sm font-bold text-[#2C2C2C] hover:bg-[#FAF8F4] sm:order-1"
          >
            Cancel
          </button>
          {!isProTier ? (
            <Link
              href="/pricing"
              onClick={onClose}
              className="order-1 inline-flex items-center justify-center rounded-full bg-[#D4A843] px-5 py-2.5 text-sm font-bold text-[#2C2C2C] shadow-sm hover:brightness-95 sm:order-2"
            >
              Upgrade Now
            </Link>
          ) : null}
        </div>
      </motion.div>
    </motion.div>
  );
}
