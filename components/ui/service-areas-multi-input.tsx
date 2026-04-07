"use client";

import { X } from "lucide-react";
import { PhLocationInput } from "@/components/ui/ph-location-input";

type Props = {
  values: string[];
  onChange: (values: string[]) => void;
  draft: string;
  onDraftChange: (v: string) => void;
  id?: string;
};

/** Multiple locations; user picks or types in PhLocationInput, then clicks Add. */
export function ServiceAreasMultiInput({ values, onChange, draft, onDraftChange, id }: Props) {
  const addCurrent = () => {
    const t = draft.trim();
    if (!t) return;
    if (values.includes(t)) {
      onDraftChange("");
      return;
    }
    onChange([...values, t]);
    onDraftChange("");
  };

  return (
    <div className="space-y-2">
      {values.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {values.map((v) => (
            <li
              key={v}
              className="inline-flex items-center gap-1 rounded-full bg-[#6B9E6E]/15 px-3 py-1 text-xs font-semibold text-[#2C2C2C]"
            >
              {v}
              <button
                type="button"
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="rounded-full p-0.5 hover:bg-[#6B9E6E]/25"
                aria-label={`Remove ${v}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <PhLocationInput
          id={id}
          value={draft}
          onChange={onDraftChange}
          placeholder="Add area (e.g. BGC, Taguig)"
          className="min-w-0 flex-1"
        />
        <button
          type="button"
          onClick={addCurrent}
          className="shrink-0 rounded-xl border border-[#6B9E6E] bg-[#6B9E6E]/10 px-4 py-2.5 text-sm font-bold text-[#2C2C2C] hover:bg-[#6B9E6E]/20"
        >
          Add
        </button>
      </div>
      <p className="text-[11px] font-semibold text-[#2C2C2C]/45">
        Choose a suggestion or type an area, then Add.
      </p>
    </div>
  );
}
