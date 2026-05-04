"use client";

import Image from "next/image";
import { useCallback, useState } from "react";
import { FileText, HelpCircle, Loader2, Users } from "lucide-react";
import { useChatContext } from "stream-chat-react";

import { Button } from "@/components/ui/button";
import { isSupportChannel } from "@/features/messaging/lib/channel-helpers";

export function MessagesOnlySupportWelcome(props: {
  variant: "client" | "agent";
  onBackToList?: () => void;
}) {
  const headline =
    props.variant === "client" ? "Go message an agent 👋" : "Reach your clients here 👋";
  const subtitle =
    props.variant === "client"
      ? "Start a conversation with our team. We're here to help you."
      : "Conversations with your clients will appear here.";

  const tip2 =
    props.variant === "client" ? "Get support with your projects" : "Get help with listings";

  const primaryLabel =
    props.variant === "client" ? "Message BahayGo Support" : "Open conversations";

  const { client, setActiveChannel } = useChatContext();
  const [opening, setOpening] = useState(false);

  const handlePrimary = useCallback(async () => {
    if (!client?.userID) {
      props.onBackToList?.();
      return;
    }
    setOpening(true);
    try {
      const channels = await client.queryChannels(
        { type: "messaging", members: { $in: [client.userID] } },
        [{ last_message_at: -1 }],
        { limit: 40 },
      );
      const support = channels.find((c) => isSupportChannel(c));
      if (support) {
        await setActiveChannel(support);
        return;
      }
    } catch {
      /* fall through */
    } finally {
      setOpening(false);
    }
    props.onBackToList?.();
  }, [client, props.onBackToList, setActiveChannel]);

  return (
    <div className="flex w-full max-w-3xl flex-col items-stretch px-4 py-2">
      <section
        className="overflow-hidden rounded-[18px] border border-[#88A382]/14 bg-[#F6F9F6] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_40px_-12px_rgba(34,60,45,0.12)]"
        aria-label="Welcome"
      >
        <div className="flex flex-col gap-8 p-6 sm:flex-row sm:items-center sm:gap-10 sm:p-8 lg:gap-12 lg:p-10">
          <div className="flex min-w-0 flex-1 flex-col justify-center space-y-4 text-left">
            <h2 className="font-serif text-xl font-bold tracking-tight text-fg sm:text-2xl lg:text-[1.65rem]">
              {headline}
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-fg/55 sm:text-[15px]">{subtitle}</p>
            <div>
              <Button
                type="button"
                size="lg"
                disabled={opening}
                onClick={() => void handlePrimary()}
                className="h-10 gap-2 rounded-lg bg-brand-sage px-5 text-sm font-semibold text-white shadow-none hover:bg-brand-sage/90 focus-visible:ring-brand-sage/40"
              >
                {opening ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Opening…
                  </>
                ) : (
                  primaryLabel
                )}
              </Button>
            </div>
          </div>

          <div className="relative flex shrink-0 items-center justify-center sm:justify-end">
            <Image
              src="/agent-illustration.png"
              alt="Illustration of a BahayGo support agent at a desk with headset and laptop."
              width={336}
              height={285}
              priority
              sizes="(min-width: 640px) 320px, min(90vw, 336px)"
              className="h-auto w-full max-w-[min(100%,320px)] object-contain object-right sm:max-w-[300px] lg:max-w-[336px]"
            />
          </div>
        </div>
      </section>

      <div className="mt-10 w-full max-w-[480px] self-center">
        <div className="rounded-2xl border border-subtle bg-surface-panel/80 px-5 py-5 text-center sm:text-left">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-sage">Need help with something?</p>
          <ul className="mt-4 space-y-3 text-left">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-sage/15 text-brand-sage">
                <HelpCircle className="h-4 w-4" aria-hidden />
              </span>
              <span className="text-sm font-medium leading-snug text-fg/80">Ask questions about our services</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-sage/15 text-brand-sage">
                <FileText className="h-4 w-4" aria-hidden />
              </span>
              <span className="text-sm font-medium leading-snug text-fg/80">{tip2}</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-sage/15 text-brand-sage">
                <Users className="h-4 w-4" aria-hidden />
              </span>
              <span className="text-sm font-medium leading-snug text-fg/80">Talk to a real human</span>
            </li>
          </ul>
          <p className="mt-5 text-center text-xs leading-relaxed text-fg/45 sm:text-left">
            Choose <span className="font-semibold text-fg/70">BahayGo Support</span> in the conversation list
            on the left to message our team.
          </p>
        </div>
      </div>
    </div>
  );
}
