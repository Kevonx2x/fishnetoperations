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
    <div className="w-full bg-white">
      <MessagesHeader />
      <div className="h-[calc(100vh-120px)] overflow-hidden">
        <StreamChatProvider>
          <ClientChatView />
        </StreamChatProvider>
      </div>
    </div>
  );
}
