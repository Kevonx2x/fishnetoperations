import { redirect } from "next/navigation";
import { StreamChatProvider } from "@/components/chat/stream-chat-provider";
import { ClientChatView } from "@/components/chat/client-chat-view";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MessagesHeader } from "@/app/messages/messages-header";

export default async function MessagesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="h-screen w-full bg-white">
      <div className="flex h-screen flex-col">
        <MessagesHeader />
        <div className="min-h-0 flex-1 overflow-hidden">
          <StreamChatProvider>
            <ClientChatView />
          </StreamChatProvider>
        </div>
      </div>
    </div>
  );
}
