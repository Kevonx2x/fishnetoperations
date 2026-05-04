function manilaHourNow(): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    hour12: false,
  }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  return Number.isFinite(h) ? h : 0;
}

function greetingSlotFromManilaHour(h: number): "morning" | "afternoon" | "evening" {
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

export function ClientDashboardGreeting(props: { firstName: string }) {
  const slot = greetingSlotFromManilaHour(manilaHourNow());
  const name = props.firstName.trim() || "there";

  return (
    <header className="space-y-1">
      <h1 className="font-serif text-2xl font-semibold tracking-tight text-[#2C2C2C] md:text-3xl">Dashboard</h1>
      <p className="font-sans text-lg font-semibold tracking-tight text-[#2C2C2C] md:text-xl">
        Good {slot}, {name}! 👋
      </p>
      <p className="max-w-2xl text-sm font-medium leading-snug text-[#2C2C2C]/65">
        Here&apos;s what&apos;s happening with your home search.
      </p>
    </header>
  );
}
