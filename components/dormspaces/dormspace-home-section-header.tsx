import { cn } from "@/lib/utils";

export function DormspaceHomeSectionHeader({
  title,
  subtitle,
  className,
}: {
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <h2 className="font-serif text-3xl font-semibold tracking-tight text-[#2C2C2C] lg:text-4xl">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-2 text-sm font-medium text-[#888888] lg:text-base">{subtitle}</p>
      ) : null}
    </div>
  );
}
