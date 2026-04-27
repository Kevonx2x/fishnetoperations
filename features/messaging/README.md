## Messaging module (Stream Chat)

### Overview
This module contains **all messaging UI + logic** built on Stream Chat. It exists to keep responsibilities clear and bugs findable quickly: components render, hooks coordinate state, and `lib/` holds Stream helpers and shared logic.

### Architecture diagram (ASCII)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           MessagingInbox (3 columns)                      │
├───────────────┬───────────────────────────────────────┬──────────────────┤
│ Conversation   │ Chat thread                            │ Context panel    │
│ list (left)    │ (middle)                               │ (right)          │
│                │                                        │                  │
│ - Search/filter│ - ChatHeader (reads useChatContext)     │ - PropertyCard   │
│ - ChannelList  │ - MessageList (Virtualized)             │   (from channel  │
│ - Preview rows │ - MessageInput                          │    metadata +    │
│                │                                        │    summary fetch)│
└───────────────┴───────────────────────────────────────┴──────────────────┘

Data flow:
- Stream client lives in StreamChatProvider (connectUser + token)
- Active channel is from Stream's `useChatContext()` (never cached in local state)
- Conversation list re-renders immediately on Stream events by bumping a key
```

### File responsibilities

- **components/**
  - **`messaging-inbox.tsx`**: Top-level 3-column shell; wires up panels and deep-link handling.
  - **`stream-chat-provider.tsx`**: Browser Stream client connection + token fetch.
  - **conversation-list/**
    - **`index.tsx`**: Left panel container; owns `ChannelList` rendering and list controls.
    - **`conversation-preview.tsx`**: One conversation row UI + pin/archive actions.
    - **`conversation-filter.tsx`**: All/Unread/Pinned/Archived dropdown.
    - **`search-bar.tsx`**: Search input UI.
  - **chat-thread/**
    - **`index.tsx`**: Middle panel; renders `Channel` + thread chrome.
    - **`chat-header.tsx`**: Header that reads the active channel fresh from `useChatContext()` every render.
    - **`message-list.tsx`**: Virtualized message list wrapper.
    - **`custom-message.tsx`**: Message bubble renderer (Model A styling).
    - **`message-input.tsx`**: Message input wrapper.
  - **context-panel/**
    - **`index.tsx`**: Right panel container; resolves propertyId and renders card or empty state.
    - **`property-card.tsx`**: Property UI card.

- **hooks/**
  - **`use-active-conversation.ts`**: Single source of truth for deep-link selection and desktop auto-select behavior.
  - **`use-channel-list.ts`**: Search/filter/sort and Stream event subscriptions (`channel.updated/hidden/visible`) to force list re-render.
  - **`use-property-summary.ts`**: Fetches property metadata and **silences AbortError** (expected on unmount).

- **lib/**
  - **`stream-client.ts`**: Stream client init helpers (server + browser).
  - **`channel-helpers.ts`**: Channel utilities (peer lookup, pinned/archived checks, sort helpers).
  - **`message-grouping.ts`**: Grouping logic for consecutive messages.

- **types/**
  - **`index.ts`**: Messaging types (channel metadata shape, peer info, filter mode).

### State management rules
- **Active channel**: always from Stream’s `useChatContext()`; never cached in component state.
- **Conversation list rerender**: forced by `use-channel-list.ts` bumping a `key` on Stream channel events.
- **Property context fetch**: via `use-property-summary.ts`; AbortError is ignored.

### Common bugs and where to look

| Symptom | Where to look | Likely cause |
|---|---|---|
| Wrong name in chat header | `components/chat-thread/chat-header.tsx` | **Root cause (historical)**: header logic living outside messaging module and/or caching peer data in component state/derived props. Fix pattern: always derive peer from `useChatContext().channel.state.members` per render. |
| Conversations not switching / snaps back | `hooks/use-active-conversation.ts` | Deep link effect or desktop auto-select effect re-running and overwriting user selection. |
| Pin/unpin doesn’t update visually | `hooks/use-channel-list.ts`, `components/conversation-list/conversation-preview.tsx` | Missing Stream event subscription or missing rerender bump after pin/archive. |
| Archive doesn’t remove from list | `hooks/use-channel-list.ts` | Filter mode not excluding archived or list not re-rendering on hidden/visible. |
| Context panel logs AbortError | `hooks/use-property-summary.ts` | AbortError should be ignored (expected on unmount). |
| Avatars show initials when photo exists | `components/stream-chat-provider.tsx`, `/api/stream/token` | Stream user `image` not being set/upserted for the user. |

### How to add a new feature (example: “Mute conversation”)
- Add action UI to `components/conversation-list/conversation-preview.tsx` (or the thread menu in `components/chat-thread/index.tsx`).
- Implement the Stream call (e.g. `channel.mute()`) and on success call the list rerender trigger (`bumpChannelListKey`) or rely on Stream events.
- If state needs to be shared (e.g. filter mode), put it in a hook under `hooks/`.
- Update this README “File responsibilities” and “Common bugs” table if the feature adds a new failure mode.

### Stream Chat docs links
- [React SDK overview](https://getstream.io/chat/docs/sdk/react/)
- [Theming (CSS variables)](https://getstream.io/chat/docs/sdk/react/theming/global-variables/)
- [Channel events](https://getstream.io/chat/docs/sdk/react/event_handling/)

### Things to NEVER do
- Cache contact info in component state (names/avatars/online status)
- Pass channel as a prop instead of reading from `useChatContext()`
- Wrap Stream components in flex containers with hard constraints that break their internal layout
- Use `!important` in CSS overrides
- Override Stream class names instead of using Stream CSS variables (prefer `--str-chat__*`)

