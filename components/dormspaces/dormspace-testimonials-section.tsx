import Link from "next/link";
import { Quote } from "lucide-react";

const TESTIMONIALS = [
  {
    quote:
      "Finding a bedspace near Taft was stressful until BahayGo. I messaged the landlord directly and moved in within a week.",
    name: "Angela D.",
    role: "Student, DLSU",
    initials: "AD",
  },
  {
    quote:
      "As a BPO worker, I needed something affordable in BGC with Wi-Fi included. The listings here actually matched what was advertised.",
    name: "Mark R.",
    role: "BPO professional",
    initials: "MR",
  },
  {
    quote:
      "Our family listed an extra room and got serious inquiries from students — no spam, no random Facebook messages.",
    name: "Liza M.",
    role: "Landlord, Quezon City",
    initials: "LM",
  },
] as const;

export function DormspaceTestimonialsSection() {
  return (
    <section className="bg-[#FAF8F4] py-6 sm:py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-serif text-xl font-bold tracking-tight text-[#2C2C2C] sm:text-2xl">
            Real stories from dormspacers
          </h2>
          <Link
            href="#"
            className="shrink-0 text-xs font-bold text-[#6B9E6E] hover:underline sm:text-sm"
          >
            Read more →
          </Link>
        </div>

        <div
          className="-mx-4 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 scrollbar-hide sm:mx-0 sm:mt-5 sm:snap-none sm:grid sm:grid-cols-3 sm:gap-3 sm:overflow-visible sm:px-0 md:gap-4"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {TESTIMONIALS.map((t) => (
            <article
              key={t.name}
              className="flex w-[min(252px,78vw)] shrink-0 snap-start flex-col rounded-xl border border-black/[0.06] bg-white p-4 shadow-[0_4px_16px_rgba(44,44,44,0.06)] sm:w-auto"
            >
              <Quote className="size-5 text-[#D4A843]/80" aria-hidden />
              <p className="mt-2.5 flex-1 text-[13px] font-medium leading-relaxed text-[#484848] sm:text-sm">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="mt-4 flex items-center gap-2.5 border-t border-black/[0.06] pt-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#6B9E6E]/12 text-[10px] font-bold text-[#4a7a4d]">
                  {t.initials}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[#2C2C2C]">{t.name}</p>
                  <p className="truncate text-[11px] font-medium text-[#888888]">{t.role}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
