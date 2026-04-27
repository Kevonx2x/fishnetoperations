# Messaging system audit (Phase 1)

This document is a point-in-time inventory of every file in the repo that touches the messaging system (Stream Chat). It is intended to be reviewed **before** any refactor work proceeds, and kept as a historical record after the refactor.

Scope includes:
- UI components (chat/inbox/thread/header/bubbles/context panel/input)
- API routes (Stream token/channel creation/sync/backfill)
- Library code (Stream client init, services, helpers)
- Hooks (custom hooks dealing with channels/messages/presence)
- Types (channel data shapes)
- CSS (Stream overrides)
- Pages (where messaging routes are defined)

> Note: `.next/` build output is explicitly ignored.

---

## UI components

### `components/chat/bahaygo-messaging-inbox.tsx`
- **What it does**: Main 3-column messaging UI built on Stream Chat React components (conversation list, thread, context panel). Also contains channel preview row, custom message bubble renderer, filtering/sorting, channel switching effects, scroll management, and Stream event subscriptions.
- **What’s wrong**:
  - Multi-responsibility “god component” that combines layout, data logic, side effects, Stream event wiring, and rendering.
  - Makes bugs (pin/archive re-render, channel switching snap-back, header staleness) hard to localize.
- **Where it should go**:
  - `features/messaging/components/messaging-inbox.tsx` (layout shell)
  - `features/messaging/components/conversation-list/*` (list UI + preview row + filter + search)
  - `features/messaging/components/chat-thread/*` (header/message list/custom message/message input)
  - `features/messaging/hooks/use-channel-list.ts` (list sorting/filtering + event subscriptions + rerender trigger)
  - `features/messaging/lib/channel-helpers.ts` + `features/messaging/lib/message-grouping.ts`

### `components/chat/chat-header.tsx`
- **What it does**: Chat thread header that reads `activeChannel` from `useChatContext()` and derives the “other” member from `channel.state.members`, rendering avatar/name/online.
- **What’s wrong**:
  - Lives outside a dedicated messaging feature module.
  - Audit indicates the stale-header bug may come from **a duplicate header** or **a parent caching/overriding the active channel**.
- **Where it should go**: `features/messaging/components/chat-thread/chat-header.tsx` (and ensure this is the only header used).

### `components/chat/conversation-context-panel.tsx`
- **What it does**: Right sidebar panel showing property context for the active conversation. Reads quick metadata from `channel.data.property_*` and fetches a property summary (with abort handling) for richer UI.
- **What’s wrong**:
  - Fetching/caching + UI are coupled in a single component.
  - Uses `console.error` for non-abort fetch failures.
- **Where it should go**:
  - `features/messaging/components/context-panel/index.tsx`
  - `features/messaging/hooks/use-property-summary.ts` (fetch + abort-silencing + caching policy)
  - `features/messaging/components/context-panel/property-card.tsx`

### `components/chat/conversation-list-filter.tsx`
- **What it does**: UI control for conversation filter mode (All/Unread/Pinned/Archived).
- **What’s wrong**: Messaging UI outside a feature module; filter logic is duplicated/implemented elsewhere in inbox.
- **Where it should go**: `features/messaging/components/conversation-list/conversation-filter.tsx`

### `components/chat/client-chat-view.tsx`
- **What it does**: Wrapper that builds Stream channel `filters`/`sort` from authenticated user, then renders the inbox with initial channel selection and context panel enabled.
- **What’s wrong**: Feature wrapper lives in global components.
- **Where it should go**: `features/messaging/components/messaging-inbox.tsx` usage wrapper or page-level assembly inside messaging feature.

### `components/chat/agent-chat-inbox.tsx`
- **What it does**: Agent version of the wrapper for inbox.
- **What’s wrong**: Same as above (feature code outside module).
- **Where it should go**: `features/messaging/components/messaging-inbox.tsx` wrapper or a dedicated entry under `features/messaging/components/`.

### `components/chat/stream-chat-provider.tsx`
- **What it does**: Browser Stream client init and `connectUser` flow. Fetches Stream token from `/api/stream/token`, then connects/upserts Stream user with best-effort image fallback.
- **What’s wrong**:
  - Uses module-level cached token (`cachedToken`, `cachedTokenUserId`) which is global mutable state.
  - Logs missing env with `console.error`.
- **Where it should go**: `features/messaging/lib/stream-client.ts` for connection logic + a small provider component inside `features/messaging/` (or kept app-level but importing messaging lib).

### `components/chat/start-chat-button.tsx`
- **What it does**: Messaging entrypoint (creates/opens a conversation).
- **What’s wrong**: Likely messaging-owned UI living outside module (not reviewed in depth in this phase).
- **Where it should go**: `features/messaging/components/` (location depends on where used).

### `app/messages/messages-header.tsx`
- **What it does**: Simple “Messages” header UI with back button.
- **What’s wrong**: Appears to be for a `/messages` route that currently redirects away; likely dead surface area.
- **Where it should go**: Delete if `/messages` stays disabled; otherwise move under messaging feature.

---

## Pages (UI routes)

### `app/dashboard/client/messages/page.tsx`
- **What it does**: Client dashboard messages page. Wraps `StreamChatProvider` and renders `ClientChatView`, reading `?channel=...` deep link.
- **What’s wrong**: Page imports multiple ad-hoc chat components instead of a single feature entrypoint.
- **Where it should go**: Page should import a top-level component from `features/messaging/components/messaging-inbox.tsx` (and provider if needed).

### `app/messages/page.tsx`
- **What it does**: Redirects `/messages` → `/`.
- **What’s wrong**: Dead messaging route; can confuse future work.
- **Where it should go**: Remove or implement properly using the messaging feature module.

---

## API routes (Stream / messaging)

> Next.js requires routes stay under `app/api/**/route.ts`. During the refactor, these route files should become thin wrappers that call business logic in `features/messaging/api/*`.

### `app/api/stream/token/route.ts`
- **What it does**: Authenticated token minting for current user; upserts Stream user from Supabase profile (+ agent image fallback) and returns Stream token.
- **What’s wrong**: Messaging business logic in the route; duplication across other sync endpoints.
- **Where it should go**: Wrapper stays; handler to `features/messaging/api/token/route.ts` (callable from wrapper).

### `app/api/stream/channel/route.ts`
- **What it does**: Creates or finds a 1:1 channel between agent+client. Upserts both users, sets optional `property_*` channel metadata, and returns `channel_id`.
- **What’s wrong**: Route mixes validation, auth, Supabase reads, Stream writes.
- **Where it should go**: Wrapper stays; handler to `features/messaging/api/channel/route.ts`.

### `app/api/stream/peer-avatar/route.ts`
- **What it does**: Returns a peer’s avatar_url if requester shares a Stream channel with them (RLS workaround).
- **What’s wrong**: Messaging utility endpoint not feature-scoped.
- **Where it should go**: Messaging-owned handler under `features/messaging/api/` (either `sync-user` or `peer-avatar`).

### `app/api/admin/stream/sync-user/route.ts`
- **What it does**: Admin endpoint to upsert a single user to Stream.
- **What’s wrong**: Logic duplicates `/api/stream/token`.
- **Where it should go**: Handler to `features/messaging/api/sync-user/route.ts`, wrapper stays.

### `app/api/admin/stream/sync-all-users/route.ts`
- **What it does**: Admin endpoint to upsert all profiles to Stream in batches.
- **What’s wrong**: Contains `console.log` noise; business logic not feature-scoped.
- **Where it should go**: Handler under `features/messaging/api/` (wrapper stays).

### `app/api/admin/stream/backfill-channel-metadata/route.ts`
- **What it does**: Admin endpoint to patch missing `property_*` metadata onto existing Stream channels.
- **What’s wrong**: Messaging-owned work is split between route + global service file.
- **Where it should go**: Handler to `features/messaging/api/backfill-metadata/route.ts`, wrapper stays.

---

## Library / services

### `lib/stream.ts`
- **What it does**: Server-side Stream Chat client singleton (API secret).
- **What’s wrong**: Logs partial secrets/keys via `console.log` (noisy and risky).
- **Where it should go**: `features/messaging/lib/stream-client.ts` (server init portion), with logging removed.

### `lib/services/stream-channel-backfill.ts`
- **What it does**: Backfills Stream channel metadata (property context) used by admin route.
- **What’s wrong**: Messaging business logic lives in a global services folder.
- **Where it should go**: `features/messaging/api/backfill-metadata/route.ts` (or `features/messaging/lib/*` if shared).

### `lib/services/property-summary.ts`
- **What it does**: Fetch helper used by conversation context panel to load minimal property data.
- **What’s wrong**: Not necessarily messaging-specific, but messaging should call it through a dedicated hook.
- **Where it should go**: Keep global if shared; messaging uses `features/messaging/hooks/use-property-summary.ts`.

---

## Hooks

No dedicated messaging hooks were found; most channel list/thread logic is currently embedded in `components/chat/bahaygo-messaging-inbox.tsx`.

- **What’s wrong**: Messaging state/data logic is not centralized, making “snap-back”, “pin doesn’t update”, and “header stale” issues hard to locate.
- **Where it should go**:
  - `features/messaging/hooks/use-active-conversation.ts`
  - `features/messaging/hooks/use-channel-list.ts`
  - `features/messaging/hooks/use-pin-archive.ts`
  - `features/messaging/hooks/use-property-summary.ts`

---

## Types

No single messaging types module exists; channel metadata and payload shapes are inline in components/routes.

- **What’s wrong**: No source of truth for channel data keys like `property_id`, `property_name`, etc.
- **Where it should go**: `features/messaging/types/index.ts`

---

## CSS (Stream overrides)

### `app/globals.css`
- **What it does**: Imports Stream Chat React v2 CSS and defines extensive theme/layout overrides for messaging under `.bahaygo-stream-chat` in `@layer stream-overrides`.
- **What’s wrong**: Must remain global, but messaging overrides are embedded inside a very large global CSS file.
- **Where it should go**: Keep in `app/globals.css`, but document in `features/messaging/README.md` as the styling source of truth for Stream overrides.

---

## Notes for Phase 2+ (bug tracing)

`components/chat/chat-header.tsx` already reads `activeChannel` from `useChatContext()` (correct pattern). If the header is stale in production, likely causes are:
- Another header component is still being used somewhere (duplicate implementation).
- A parent component caches/passes channel/peer as props and doesn’t update.
- `activeChannel` itself is being reset/overwritten by an effect (channel switching snap-back), making the header appear “wrong”.

