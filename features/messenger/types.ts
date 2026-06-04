export type MessengerNavId =
  | "messages"
  | "groups"
  | "calls"
  | "contacts"
  | "notifications"
  | "saved"
  | "settings";

export type ConversationTab = "all" | "unread" | "favorites";

export type MockParticipant = {
  id: string;
  name: string;
  initials: string;
  online: boolean;
};

export type MockReaction = {
  emoji: string;
  count: number;
};

export type MockMessage = {
  id: string;
  text: string;
  sent: boolean;
  time: string;
  read?: boolean;
  reactions?: MockReaction[];
  dateDivider?: string;
};

export type MockConversation = {
  id: string;
  participant: MockParticipant;
  lastMessage: string;
  timestamp: string;
  unread: number;
  favorite: boolean;
  typing?: boolean;
  messages: MockMessage[];
};

export type MockCurrentUser = {
  name: string;
  initials: string;
  online: boolean;
};
