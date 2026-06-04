import { CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MockMessage } from "../types";

type Props = {
  message: MockMessage;
};

export function MessageBubble({ message }: Props) {
  if (message.dateDivider) {
    return (
      <div className="flex justify-center py-3" role="separator">
        <span className="rounded-full bg-[#2C2C2C]/[0.06] px-3 py-1 text-[11px] font-medium text-[#888888]">
          {message.dateDivider}
        </span>
      </div>
    );
  }

  const sent = message.sent;

  return (
    <div
      className={cn("flex w-full min-w-0 px-3", sent ? "justify-end" : "justify-start")}
    >
      <div className={cn("flex max-w-[min(85%,20rem)] flex-col gap-1", sent && "items-end")}>
        <div
          className={cn(
            "px-3.5 py-2.5 text-[15px] leading-snug",
            sent
              ? "rounded-[18px] rounded-br-[4px] bg-[#6B9E6E] text-white"
              : "rounded-[18px] rounded-bl-[4px] border border-[#2C2C2C]/8 bg-white text-[#2C2C2C] shadow-[0_1px_2px_rgba(44,44,44,0.04)]",
          )}
        >
          {message.text}
        </div>

        {message.reactions && message.reactions.length > 0 ? (
          <div
            className={cn(
              "flex flex-wrap gap-1",
              sent ? "-mt-1 mr-1 justify-end" : "-mt-1 ml-1 justify-start",
            )}
          >
            {message.reactions.map((r) => (
              <span
                key={r.emoji}
                className="inline-flex items-center gap-0.5 rounded-full border border-[#2C2C2C]/10 bg-[#FAF8F4] px-2 py-0.5 text-xs shadow-sm"
              >
                <span>{r.emoji}</span>
                {r.count > 1 ? (
                  <span className="text-[10px] font-medium text-[#888888]">{r.count}</span>
                ) : null}
              </span>
            ))}
          </div>
        ) : null}

        <div
          className={cn(
            "flex items-center gap-1 px-0.5 text-[10px] text-[#888888]",
            sent && "flex-row-reverse",
          )}
        >
          <span>{message.time}</span>
          {sent && message.read ? (
            <CheckCheck className="h-3.5 w-3.5 text-[#6B9E6E]" aria-label="Read" />
          ) : null}
        </div>
      </div>
    </div>
  );
}
