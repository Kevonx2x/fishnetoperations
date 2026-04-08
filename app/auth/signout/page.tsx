"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function SignOutPage() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const show = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(show);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setLeaving(true);
    }, 3000);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(() => {
      router.replace("/");
    }, 400);
    return () => window.clearTimeout(t);
  }, [leaving, router]);

  return (
    <motion.div
      className="flex min-h-screen flex-col items-center justify-center bg-white px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: visible && !leaving ? 1 : 0 }}
      transition={{ duration: 0.45 }}
    >
      <p className="text-6xl" aria-hidden>
        👋
      </p>
      <h1 className="mt-8 font-serif text-3xl font-bold tracking-tight text-[#2C2C2C]">
        Sorry to see you go!
      </h1>
      <p className="mt-3 max-w-md text-center text-base font-medium text-[#2C2C2C]/65">
        We hope to see you back soon. Your home is waiting.
      </p>
    </motion.div>
  );
}
