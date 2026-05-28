"use client";

import { Paperclip } from "lucide-react";
import { MessageInput as StreamMessageInput } from "stream-chat-react";

function AttachmentButtonIcon() {
  return <Paperclip className="size-5 shrink-0 text-[#6B9E6E]" strokeWidth={2} aria-hidden />;
}

export function MessageInput() {
  return (
    <StreamMessageInput
      {...({
        FileUploadIcon: AttachmentButtonIcon,
      } as Record<string, unknown>)}
    />
  );
}
