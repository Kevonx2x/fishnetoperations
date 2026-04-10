-- Ensure read_at exists for notification read persistence (idempotent).
alter table public.notifications add column if not exists read_at timestamptz;

create index if not exists notifications_user_unread_idx on public.notifications (user_id) where read_at is null;
