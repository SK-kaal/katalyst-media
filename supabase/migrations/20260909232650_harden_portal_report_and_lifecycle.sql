-- Make campaign.status the sole client-report access control, minimise the
-- public report payload, and close anonymous snapshot-table write access.

-- Preserve legacy titles before removing duplicate title fields.
update public.campaigns
set sound_title = coalesce(
  nullif(trim(sound_title), ''),
  nullif(trim(release_title), ''),
  nullif(trim(campaign_name), ''),
  'Untitled campaign'
);

-- Every campaign in the current workflow has a delivery target. For legacy
-- rows, use at least one or the number of already tracked posts.
update public.campaigns c
set target_posts = greatest(
  1,
  coalesce((
    select count(*)::integer
    from public.tiktok_posts p
    where p.campaign_id = c.id
  ), 0)
)
where target_posts is null or target_posts < 1;

alter table public.campaigns
  alter column target_posts set not null,
  alter column share_token set not null;

alter table public.campaigns
  drop constraint if exists campaigns_target_posts_check;

alter table public.campaigns
  add constraint campaigns_target_posts_check check (target_posts >= 1);

alter table public.campaigns
  drop constraint if exists campaigns_share_token_length_check;

alter table public.campaigns
  add constraint campaigns_share_token_length_check
  check (length(share_token) >= 40);

-- These fields represented previous report/state models or duplicated data.
drop table if exists public.campaign_daily_performance;

alter table public.campaigns
  drop column if exists amount_spent,
  drop column if exists share_enabled,
  drop column if exists start_date,
  drop column if exists end_date,
  drop column if exists campaign_name,
  drop column if exists release_title;

-- The unique constraint already provides the report-token index.
drop index if exists public.campaigns_share_token_idx;

-- Keep concurrent refreshes from recording the same metrics more than once.
with ranked as (
  select
    id,
    row_number() over (
      partition by post_id, views, likes, comments, shares
      order by captured_at, id
    ) as position
  from public.post_metric_snapshots
)
delete from public.post_metric_snapshots s
using ranked r
where s.id = r.id and r.position > 1;

with ranked as (
  select
    id,
    row_number() over (
      partition by campaign_id, sound_id, creation_count
      order by captured_at, id
    ) as position
  from public.sound_metric_snapshots
)
delete from public.sound_metric_snapshots s
using ranked r
where s.id = r.id and r.position > 1;

with ranked as (
  select
    id,
    row_number() over (
      partition by campaign_id, tracked_posts, views, likes, comments, shares
      order by captured_at, id
    ) as position
  from public.campaign_metric_snapshots
)
delete from public.campaign_metric_snapshots s
using ranked r
where s.id = r.id and r.position > 1;

create unique index if not exists post_metric_snapshots_metrics_unique
  on public.post_metric_snapshots (post_id, views, likes, comments, shares);

create unique index if not exists sound_metric_snapshots_metrics_unique
  on public.sound_metric_snapshots (
    campaign_id,
    coalesce(sound_id, ''),
    creation_count
  );

create unique index if not exists campaign_metric_snapshots_metrics_unique
  on public.campaign_metric_snapshots (
    campaign_id,
    tracked_posts,
    views,
    likes,
    comments,
    shares
  );

alter table public.post_metric_snapshots
  drop constraint if exists post_metric_snapshots_nonnegative_check;
alter table public.post_metric_snapshots
  add constraint post_metric_snapshots_nonnegative_check
  check (views >= 0 and likes >= 0 and comments >= 0 and shares >= 0);

alter table public.sound_metric_snapshots
  drop constraint if exists sound_metric_snapshots_nonnegative_check;
alter table public.sound_metric_snapshots
  add constraint sound_metric_snapshots_nonnegative_check
  check (creation_count >= 0);

alter table public.campaign_metric_snapshots
  drop constraint if exists campaign_metric_snapshots_nonnegative_check;
alter table public.campaign_metric_snapshots
  add constraint campaign_metric_snapshots_nonnegative_check
  check (
    tracked_posts >= 0
    and views >= 0
    and likes >= 0
    and comments >= 0
    and shares >= 0
    and engagement_rate >= 0
  );

-- Previous policies were granted to PUBLIC, which includes anonymous users.
drop policy if exists "service sound snapshots"
  on public.sound_metric_snapshots;
drop policy if exists "service campaign snapshots"
  on public.campaign_metric_snapshots;
drop policy if exists "Authenticated full access sound snapshots"
  on public.sound_metric_snapshots;
drop policy if exists "Authenticated full access campaign snapshots"
  on public.campaign_metric_snapshots;

create policy "Authenticated full access sound snapshots"
  on public.sound_metric_snapshots
  for all
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated full access campaign snapshots"
  on public.campaign_metric_snapshots
  for all
  to authenticated
  using (true)
  with check (true);

-- Public reports receive only fields used by the read-only client view.
-- Internal notes, email, report tokens, provider errors and admin metadata
-- must never cross this boundary.
create or replace function public.fetch_shared_report(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  result jsonb;
begin
  if p_token is null or length(trim(p_token)) < 40 then
    return null;
  end if;

  select jsonb_build_object(
    'campaign', jsonb_build_object(
      'status', c.status,
      'budget', c.budget,
      'display_title', c.display_title,
      'tiktok_sound_url', c.tiktok_sound_url,
      'sound_title', c.sound_title,
      'sound_artist', c.sound_artist,
      'artwork_url', c.artwork_url,
      'sound_artwork_url', c.sound_artwork_url,
      'sound_usage_count', c.sound_usage_count,
      'target_posts', c.target_posts
    ),
    'client', jsonb_build_object(
      'name', cl.name,
      'handle', cl.handle,
      'profile_image_url', cl.profile_image_url
    ),
    'posts', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'post_url', p.post_url,
          'title', p.title,
          'creator_handle', p.creator_handle,
          'creator_display_name', p.creator_display_name,
          'thumbnail_url', p.thumbnail_url,
          'posted_at', p.posted_at,
          'views', p.views,
          'likes', p.likes,
          'comments', p.comments,
          'shares', p.shares,
          'created_at', p.created_at
        )
        order by p.views desc
      )
      from public.tiktok_posts p
      where p.campaign_id = c.id
    ), '[]'::jsonb),
    'snapshots', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'post_id', s.post_id,
          'captured_at', s.captured_at,
          'views', s.views
        )
        order by s.captured_at asc
      )
      from public.post_metric_snapshots s
      join public.tiktok_posts p on p.id = s.post_id
      where p.campaign_id = c.id
    ), '[]'::jsonb),
    'sound_snapshots', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'captured_at', ss.captured_at,
          'creation_count', ss.creation_count
        )
        order by ss.captured_at asc
      )
      from public.sound_metric_snapshots ss
      where ss.campaign_id = c.id
    ), '[]'::jsonb),
    'campaign_snapshots', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'captured_at', cs.captured_at,
          'views', cs.views
        )
        order by cs.captured_at asc
      )
      from public.campaign_metric_snapshots cs
      where cs.campaign_id = c.id
    ), '[]'::jsonb)
  )
  into result
  from public.campaigns c
  join public.clients cl on cl.id = c.client_id
  where c.share_token = trim(p_token)
    and c.status = 'active'
    and c.trashed_at is null
  limit 1;

  return result;
end;
$function$;

revoke all on function public.fetch_shared_report(text) from public;
revoke all on function public.fetch_shared_report(text) from authenticated;
grant execute on function public.fetch_shared_report(text) to anon;
grant execute on function public.fetch_shared_report(text) to service_role;

-- The shared timestamp trigger function does not need schema resolution.
alter function public.update_updated_at_column() set search_path = '';
