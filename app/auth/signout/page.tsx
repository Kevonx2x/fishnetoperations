"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Home } from "lucide-react";
import { motion } from "framer-motion";

export default function SignOutPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6">
      <motion.div
        className="flex max-w-md flex-col items-center text-center"
        initial={{ opacity: 0, y: 16 }}
        animate={mounted ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center gap-2">
          <Home className="h-10 w-10 text-[#D4A843]" strokeWidth={1.75} aria-hidden />
          <span className="font-serif text-3xl font-bold tracking-tight text-[#2C2C2C] sm:text-4xl">
            BahayGo
          </span>
        </div>
        <p className="mt-8 text-base font-medium leading-relaxed text-[#2C2C2C]/75 sm:text-lg">
          Sorry to see you go. Your dream home will still be here when you get back.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex rounded-full bg-[#6B9E6E] px-8 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#5d8a60]"
        >
          Back to BahayGo
        </Link>
      </motion.div>
    </div>
  );
}
