import { BadgeCheck, HeartHandshake, Shield } from "lucide-react";

function TrustItem({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="text-center sm:text-left">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#6B9E6E]/12 sm:mx-0">
        {icon}
      </div>
      <p className="mt-3 font-serif text-base font-bold text-[#2C2C2C]">{title}</p>
      <p className="mt-1 text-sm font-medium leading-relaxed text-[#484848]">{body}</p>
    </div>
  );
}

export function DormspaceTrustStrip() {
  return (
    <section className="mt-10">
      <div className="rounded-2xl border border-[#DDDDDD] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_6px_16px_rgba(0,0,0,0.08)] md:p-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          <TrustItem
            icon={<BadgeCheck className="h-5 w-5 text-[#6B9E6E]" />}
            title="ID Verified Landlords"
            body="Every dormspace owner submits valid ID and proof of billing"
          />
          <TrustItem
            icon={<Shield className="h-5 w-5 text-[#6B9E6E]" />}
            title="No Scam Listings"
            body="We review every listing before it goes live"
          />
          <TrustItem
            icon={<HeartHandshake className="h-5 w-5 text-[#6B9E6E]" />}
            title="Free for Everyone"
            body="No fees for landlords or tenants — ever"
          />
        </div>
      </div>
    </section>
  );
}
