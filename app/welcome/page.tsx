"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/auth-context";
import { postWelcomeHomeHref } from "@/lib/welcome-destination";

const VISITED_KEY = "bahaygo_has_visited";

const CLIENT_IMG =
  "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80";
const AGENT_IMG =
  "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80";

export default function WelcomePage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [isMobile, setIsMobile] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (user) {
      router.replace(postWelcomeHomeHref(profile?.role ?? null));
      return;
    }
    try {
      if (localStorage.getItem(VISITED_KEY) === "true") {
        router.replace("/");
        return;
      }
    } catch {
      /* ignore */
    }
    setShowWelcome(true);
  }, [loading, user, profile?.role, router]);

  const markVisitedAndGo = useCallback(
    (href: string) => {
      try {
        localStorage.setItem(VISITED_KEY, "true");
      } catch {
        /* ignore */
      }
      router.push(href);
    },
    [router],
  );

  const onClient = () => markVisitedAndGo("/auth/signup");
  const onAgent = () => markVisitedAndGo("/register/agent");

  const easeOut = [0.22, 1, 0.36, 1] as const;

  const logoMotion = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.5, ease: easeOut },
  };

  const card1Motion = isMobile
    ? {
        initial: { y: 40, opacity: 0 },
        animate: { y: 0, opacity: 1 },
        transition: { duration: 0.6, ease: easeOut, delay: 0.4 },
      }
    : {
        initial: { x: -60, opacity: 0 },
        animate: { x: 0, opacity: 1 },
        transition: { duration: 0.6, ease: easeOut, delay: 0.4 },
      };

  const card2Motion = isMobile
    ? {
        initial: { y: 40, opacity: 0 },
        animate: { y: 0, opacity: 1 },
        transition: { duration: 0.6, ease: easeOut, delay: 0.55 },
      }
    : {
        initial: { x: 60, opacity: 0 },
        animate: { x: 0, opacity: 1 },
        transition: { duration: 0.6, ease: easeOut, delay: 0.6 },
      };

  const footerMotion = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.4, ease: easeOut, delay: 1.0 },
  };

  if (loading || user || !showWelcome) {
    return (
      <div className="fixed inset-0 z-[300] flex min-h-[100dvh] min-w-[100vw] items-center justify-center bg-[#FAF8F4]" />
    );
  }

  return (
    <div className="fixed inset-0 z-[300] flex min-h-[100dvh] min-w-[100vw] flex-col bg-[#FAF8F4] font-sans text-[#2C2C2C]">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-between px-4 py-10 md:py-14">
        <motion.div {...logoMotion} className="shrink-0 pt-2 text-center md:pt-4">
          <h1 className="font-serif text-2xl font-bold tracking-tight md:text-4xl">
            <span className="text-[#2C2C2C]">Bahay</span>
            <span className="text-[#6B9E6E]">Go</span>
          </h1>
        </motion.div>

        <div className="flex w-full max-w-[880px] flex-1 flex-col items-center justify-center gap-4 py-8 md:flex-row md:gap-8 md:py-10">
          <motion.button
            type="button"
            onClick={onClient}
            {...card1Motion}
            className="group relative h-[240px] w-full max-w-[400px] shrink-0 cursor-pointer overflow-hidden rounded-2xl border-0 bg-transparent p-0 text-left shadow-lg outline-none transition-shadow duration-200 hover:shadow-2xl focus-visible:ring-2 focus-visible:ring-[#D4A843] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAF8F4] md:h-[280px]"
          >
            <span className="absolute inset-0 scale-100 transition-transform duration-200 group-hover:scale-[1.02]">
              <Image src={CLIENT_IMG} alt="" fill className="object-cover" sizes="400px" priority />
              <span
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.55) 100%)",
                }}
              />
            </span>
            <span className="relative z-10 flex h-full flex-col justify-end p-6">
              <span className="font-sans text-xl font-bold text-white md:text-2xl">I&apos;m looking for a home</span>
              <span className="mt-2 font-sans text-sm text-white/80">
                Browse listings, save properties, connect with verified agents
              </span>
            </span>
          </motion.button>

          <motion.button
            type="button"
            onClick={onAgent}
            {...card2Motion}
            className="group relative h-[240px] w-full max-w-[400px] shrink-0 cursor-pointer overflow-hidden rounded-2xl border-0 bg-transparent p-0 text-left shadow-lg outline-none transition-shadow duration-200 hover:shadow-2xl focus-visible:ring-2 focus-visible:ring-[#D4A843] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAF8F4] md:h-[280px]"
          >
            <span className="absolute inset-0 scale-100 transition-transform duration-200 group-hover:scale-[1.02]">
              <Image src={AGENT_IMG} alt="" fill className="object-cover" sizes="400px" priority />
              <span
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.55) 100%)",
                }}
              />
            </span>
            <span className="relative z-10 flex h-full flex-col justify-end p-6">
              <span className="font-sans text-xl font-bold text-white md:text-2xl">
                I&apos;m a real estate professional
              </span>
              <span className="mt-2 font-sans text-sm text-white/80">
                List properties, manage leads, grow your business
              </span>
            </span>
          </motion.button>
        </div>

        <motion.p
          {...footerMotion}
          className="shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] text-center font-sans text-xs text-[#888888]"
        >
          BahayGo Realty Services · Philippines
        </motion.p>
      </div>
    </div>
  );
}
