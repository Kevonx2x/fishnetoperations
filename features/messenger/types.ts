export type ConversationTab = "all" | "unread" | "favorites";

export type MessengerParticipant = {
  id: string;
  name: string;
  initials: string;
  online: boolean;
};

export type MessengerReaction = {
  emoji: string;
  count: number;
};

export type MessengerMessage = {
  id: string;
  text: string;
  sent: boolean;
  time: string;
  read?: boolean;
  reactions?: MessengerReaction[];
  dateDivider?: string;
};

export type MessengerConversation = {
  id: string;
  participant: MessengerParticipant;
  lastMessage: string;
  timestamp: string;
  unread: number;
  favorite: boolean;
  typing?: boolean;
  messages: MessengerMessage[];
  /** True while the active thread's messages are being fetched. */
  messagesLoading?: boolean;
  /** Other participant's last_read_at (for sent-message read ticks). */
  peerLastReadAt?: string | null;
  /** Current user's last_read_at on this thread. */
  myLastReadAt?: string | null;
};

/** @deprecated Use MessengerParticipant */
export type MockParticipant = MessengerParticipant;

/** @deprecated Use MessengerMessage */
export type MockMessage = MessengerMessage;

/** @deprecated Use MessengerConversation */
export type MockConversation = MessengerConversation;
