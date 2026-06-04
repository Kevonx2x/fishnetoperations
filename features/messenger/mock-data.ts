import type { MockConversation } from "./types";

export const MOCK_CONVERSATIONS: MockConversation[] = [
  {
    id: "conv-1",
    participant: {
      id: "u-1",
      name: "James Rivera",
      initials: "JR",
      online: true,
    },
    lastMessage: "I'll send the floor plan tonight.",
    timestamp: "2:14 PM",
    unread: 2,
    favorite: true,
    typing: true,
    messages: [
      { id: "m1", text: "Hi Maria — still interested in the Makati unit?", sent: false, time: "10:02 AM" },
      {
        id: "m2",
        text: "Yes! Can we schedule a viewing this weekend?",
        sent: true,
        time: "10:05 AM",
        read: true,
      },
      {
        id: "m3",
        text: "Saturday 2 PM works on my end.",
        sent: false,
        time: "10:18 AM",
        reactions: [{ emoji: "👍", count: 1 }],
      },
      { id: "d1", text: "", sent: false, time: "", dateDivider: "Today" },
      {
        id: "m4",
        text: "Perfect. I'll confirm with the landlord.",
        sent: true,
        time: "1:48 PM",
        read: true,
      },
      {
        id: "m5",
        text: "I'll send the floor plan tonight.",
        sent: false,
        time: "2:14 PM",
      },
    ],
  },
  {
    id: "conv-2",
    participant: {
      id: "u-2",
      name: "Ana Dela Cruz",
      initials: "AD",
      online: false,
    },
    lastMessage: "Thank you — payment received.",
    timestamp: "Yesterday",
    unread: 0,
    favorite: true,
    messages: [
      {
        id: "m6",
        text: "Lease docs are ready for signature.",
        sent: false,
        time: "4:20 PM",
      },
      {
        id: "m7",
        text: "Signed and uploaded to My Documents.",
        sent: true,
        time: "5:02 PM",
        read: true,
        reactions: [{ emoji: "✅", count: 1 }],
      },
      {
        id: "m8",
        text: "Thank you — payment received.",
        sent: false,
        time: "5:15 PM",
      },
    ],
  },
  {
    id: "conv-3",
    participant: {
      id: "u-3",
      name: "Luis Mendoza",
      initials: "LM",
      online: true,
    },
    lastMessage: "You: Open house is Sunday 10 AM",
    timestamp: "Mon",
    unread: 0,
    favorite: false,
    messages: [
      {
        id: "m9",
        text: "Any updates on the BGC listing?",
        sent: false,
        time: "9:10 AM",
      },
      {
        id: "m10",
        text: "Open house is Sunday 10 AM — I'll share the invite link.",
        sent: true,
        time: "9:22 AM",
        read: true,
      },
    ],
  },
  {
    id: "conv-4",
    participant: {
      id: "u-4",
      name: "FishNet Support",
      initials: "FS",
      online: true,
    },
    lastMessage: "Your verification badge is active.",
    timestamp: "Sun",
    unread: 1,
    favorite: false,
    messages: [
      {
        id: "m11",
        text: "Welcome to BahayGo Messenger. Reply here for account help.",
        sent: false,
        time: "11:00 AM",
      },
      {
        id: "m12",
        text: "Your verification badge is active.",
        sent: false,
        time: "11:01 AM",
      },
    ],
  },
];

export const DEFAULT_CONVERSATION_ID = MOCK_CONVERSATIONS[0]?.id ?? "";
