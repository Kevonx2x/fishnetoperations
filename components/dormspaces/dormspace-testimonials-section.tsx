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
    <section className="border-t border-[#2C2C2C]/8 bg-[#FAF8F4] py-10 sm:py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-serif text-2xl font-bold tracking-tight text-[#2C2C2C] md:text-3xl">
            Real stories from dormspacers
          </h2>
          <Link href="#" className="shrink-0 text-sm font-bold text-[#6B9E6E] hover:underline">
            Read more reviews →
          </Link>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <article
              key={t.name}
              className="flex flex-col rounded-2xl border border-[#DDDDDD] bg-white p-6 shadow-[0_2px_12px_rgba(44,44,44,0.05)]"
            >
              <Quote className="size-8 text-[#D4A843]/80" aria-hidden />
              <p className="mt-4 flex-1 text-sm font-medium leading-relaxed text-[#484848]">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="mt-6 flex items-center gap-3 border-t border-[#2C2C2C]/8 pt-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#6B9E6E]/15 text-xs font-bold text-[#4a7a4d]">
                  {t.initials}
                </span>
                <div>
                  <p className="text-sm font-bold text-[#2C2C2C]">{t.name}</p>
                  <p className="text-xs font-medium text-[#888888]">{t.role}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
