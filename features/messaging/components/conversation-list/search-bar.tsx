import { Search } from "lucide-react";

export function SearchBar(props: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={props.className ? `relative min-w-0 flex-1 ${props.className}` : "relative min-w-0 flex-1"}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg/35"
        aria-hidden
      />
      <input
        type="search"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder ?? "Search conversations..."}
        className="w-full rounded-full border border-fg/10 bg-surface-page py-2 pl-9 pr-3 text-sm text-fg outline-none ring-brand-sage/30 placeholder:text-fg/40 focus:ring-2"
      />
    </label>
  );
}

