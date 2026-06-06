/** Supabase row shapes for in-house messenger tables. */

export type DbConversation = {
  id: string;
  last_message_at: string | null;
  created_at: string;
};

export type DbConversationParticipant = {
  conversation_id: string;
  user_id: string;
  last_read_at: string | null;
  is_favorite?: boolean | null;
};

export type DbMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  attachment_url: string | null;
  created_at: string;
};

export type DbProfileSnippet = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

export type DbParticipantWithProfile = DbConversationParticipant & {
  profiles: DbProfileSnippet | DbProfileSnippet[] | null;
};
