import { ListFilter, Mail, Pin, Archive } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type ConversationListFilterMode = "all" | "unread" | "pinned" | "archived";

const LABEL_BY_MODE: Record<ConversationListFilterMode, string> = {
  all: "All conversations",
  unread: "Unread only",
  pinned: "Pinned only",
  archived: "Archived",
};

/**
 * Conversation list filter dropdown (client-side only).
 * Controls which channels are visible in the left-hand conversation list.
 */
export function ConversationListFilter(props: {
  value: ConversationListFilterMode;
  onChange: (next: ConversationListFilterMode) => void;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={LABEL_BY_MODE[props.value]}
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-fg/10 bg-surface-panel text-fg/55 transition-colors hover:bg-surface-page",
            props.value !== "all" && "border-brand-sage/40 bg-brand-sage/10 text-brand-sage",
            props.className,
          )}
          aria-label="Filter conversations"
        >
          <ListFilter className="h-4 w-4" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[220px] border border-[#2C2C2C]/10 bg-[#FAF8F4] text-[#2C2C2C]"
      >
        <DropdownMenuItem
          onClick={() => props.onChange("all")}
          className={cn(
            "font-semibold hover:bg-[#6B9E6E]/12 focus:bg-[#6B9E6E]/12",
            props.value === "all" && "text-[#2C5F32]",
          )}
        >
          <Mail className="mr-2 h-4 w-4 text-[#6B9E6E]" aria-hidden />
          {LABEL_BY_MODE.all}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => props.onChange("unread")}
          className={cn(
            "font-semibold hover:bg-[#6B9E6E]/12 focus:bg-[#6B9E6E]/12",
            props.value === "unread" && "text-[#2C5F32]",
          )}
        >
          <ListFilter className="mr-2 h-4 w-4 text-[#6B9E6E]" aria-hidden />
          {LABEL_BY_MODE.unread}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => props.onChange("pinned")}
          className={cn(
            "font-semibold hover:bg-[#6B9E6E]/12 focus:bg-[#6B9E6E]/12",
            props.value === "pinned" && "text-[#2C5F32]",
          )}
        >
          <Pin className="mr-2 h-4 w-4 text-[#6B9E6E]" aria-hidden />
          {LABEL_BY_MODE.pinned}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => props.onChange("archived")}
          className={cn(
            "font-semibold hover:bg-[#6B9E6E]/12 focus:bg-[#6B9E6E]/12",
            props.value === "archived" && "text-[#2C5F32]",
          )}
        >
          <Archive className="mr-2 h-4 w-4 text-[#6B9E6E]" aria-hidden />
          {LABEL_BY_MODE.archived}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

