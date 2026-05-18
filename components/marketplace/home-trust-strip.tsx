import { BadgeCheck, Lock, Shield } from "lucide-react";

function Trust({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="text-center sm:text-left">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[#6B9E6E]/12 sm:mx-0">
        {icon}
      </div>
      <p className="mt-3 font-serif text-base font-bold text-[#2C2C2C]">{title}</p>
      <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">{body}</p>
    </div>
  );
}

/** Same trust strip as homepage (All Agents Verified, Licensed Agencies Only, Anti-Scam). */
export function HomeTrustStrip() {
  return (
    <section className="mt-10">
      <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <Trust
            icon={<Shield className="h-5 w-5 text-[#6B9E6E]" />}
            title="All Agents Verified"
            body="Every agent on BahayGo has a verified PRC license"
          />
          <Trust
            icon={<BadgeCheck className="h-5 w-5 text-[#6B9E6E]" />}
            title="Licensed Agencies Only"
            body="All agencies are registered and monitored"
          />
          <Trust
            icon={<Lock className="h-5 w-5 text-[#6B9E6E]" />}
            title="Anti-Scam Protection"
            body="Zero tolerance policy. Report and remove instantly"
          />
        </div>
      </div>
    </section>
  );
}
