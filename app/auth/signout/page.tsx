"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function SignOutPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      router.replace("/");
    }, 2000);
    return () => window.clearTimeout(t);
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6">
      <motion.div
        className="flex max-w-md flex-col items-center text-center"
        initial={{ opacity: 0, y: 16 }}
        animate={mounted ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="text-7xl leading-none" aria-hidden>
          👋
        </p>
        <h1 className="mt-8 font-serif text-3xl font-bold tracking-tight text-[#2C2C2C] sm:text-4xl">
          Sorry to see you go!
        </h1>
        <p className="mt-3 text-base font-medium text-[#2C2C2C]/65 sm:text-lg">
          We hope to see you back soon. Your home is waiting.
        </p>
      </motion.div>
    </div>
  );
}
