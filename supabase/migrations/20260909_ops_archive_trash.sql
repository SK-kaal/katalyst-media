-- Ops pass: archive clients, trash campaigns, display title, post sync errors
-- Applied remotely via Supabase MCP; kept for repo history.

alter table public.clients
  add column if not exists archived_at timestamptz null;

alter table public.campaigns
  add column if not exists trashed_at timestamptz null,
  add column if not exists display_title text null;

alter table public.tiktok_posts
  add column if not exists last_sync_error text null,
  add column if not exists last_sync_status text null;

create index if not exists clients_archived_at_idx on public.clients (archived_at);
create index if not exists campaigns_trashed_at_idx on public.campaigns (trashed_at);
create index if not exists campaigns_client_id_idx on public.campaigns (client_id);

comment on column public.clients.archived_at is 'Soft-archive; null means active in normal lists';
comment on column public.campaigns.trashed_at is 'Soft-trash for mistaken campaigns; null means visible';
comment on column public.campaigns.display_title is 'Optional manual override for campaign headline';
comment on column public.campaigns.amount_spent is 'Deprecated for current portal UX; budget only';
comment on column public.tiktok_posts.last_sync_error is 'Last refresh/import error message if any';
comment on column public.tiktok_posts.last_sync_status is 'ok | failed | pending';
