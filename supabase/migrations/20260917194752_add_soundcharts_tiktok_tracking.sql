-- Cache the Soundcharts identity resolved from the currently attached TikTok
-- sound. Application code clears this whenever the TikTok sound changes.
alter table public.campaigns
  add column if not exists soundcharts_song_uuid uuid;

comment on column public.campaigns.soundcharts_song_uuid is
  'Cached Soundcharts song UUID resolved from the current tiktok_sound_id.';

-- Keep provider time separate from Katalyst collection time. Existing rows
-- came from TikTok HTML and do not have a trustworthy provider date, so their
-- provider_data_date deliberately remains null.
alter table public.sound_metric_snapshots
  add column if not exists provider_data_date date,
  add column if not exists checked_at timestamptz;

update public.sound_metric_snapshots
set checked_at = captured_at
where checked_at is null;

alter table public.sound_metric_snapshots
  alter column checked_at set default now(),
  alter column checked_at set not null;

comment on column public.sound_metric_snapshots.provider_data_date is
  'Date of the Soundcharts audience datapoint; null for legacy non-Soundcharts rows.';
comment on column public.sound_metric_snapshots.checked_at is
  'When Katalyst most recently confirmed this provider datapoint.';

-- The former uniqueness rule suppressed a valid flat datapoint whenever the
-- provider published the same count on a new date. Provider rows are unique by
-- provider date and are updated in place if Soundcharts corrects that date.
drop index if exists public.sound_metric_snapshots_metrics_unique;

create unique index if not exists sound_metric_snapshots_provider_point_unique
  on public.sound_metric_snapshots (
    campaign_id,
    coalesce(sound_id, ''),
    provider_data_date
  )
  where provider_data_date is not null;

-- Preserve the old dedupe behavior for rows whose provider date is unknown.
create unique index if not exists sound_metric_snapshots_legacy_metrics_unique
  on public.sound_metric_snapshots (
    campaign_id,
    coalesce(sound_id, ''),
    creation_count
  )
  where provider_data_date is null;

create index if not exists sound_metric_snapshots_campaign_provider_idx
  on public.sound_metric_snapshots (
    campaign_id,
    provider_data_date desc,
    checked_at desc
  )
  where provider_data_date is not null;

-- Keep the report payload narrow. Provider/check dates and campaign creation
-- time are safe client-visible fields used only for chart dates, freshness,
-- and growth from campaign start. Internal Soundcharts UUIDs stay private.
create or replace function private.fetch_shared_report_impl(p_token text)
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
      'created_at', c.created_at,
      'display_title', c.display_title,
      'tiktok_sound_url', c.tiktok_sound_url,
      'sound_title', coalesce(c.sound_title_override, c.sound_title),
      'sound_artist', coalesce(c.sound_artist_override, c.sound_artist),
      'artwork_url', c.artwork_url,
      'sound_artwork_url', c.sound_artwork_url,
      'sound_usage_count', c.sound_usage_count,
      'target_posts', c.target_posts
    ),
    'client', jsonb_build_object(
      'name', cl.name
    ),
    'posts', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.post_url,
          'post_url', p.post_url,
          'creator_handle', p.creator_handle,
          'thumbnail_url', p.thumbnail_url,
          'posted_at', p.posted_at,
          'views', p.views,
          'likes', p.likes,
          'comments', p.comments,
          'shares', p.shares,
          'created_at', p.created_at
        )
        order by
          p.views desc,
          p.likes desc,
          p.shares desc,
          p.comments desc,
          p.created_at desc,
          p.post_url asc
      )
      from public.tiktok_posts p
      where p.campaign_id = c.id
    ), '[]'::jsonb),
    'snapshots', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'post_id', p.post_url,
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
          'provider_data_date', ss.provider_data_date,
          'checked_at', ss.checked_at,
          'creation_count', ss.creation_count
        )
        order by
          ss.provider_data_date asc nulls first,
          ss.captured_at asc
      )
      from public.sound_metric_snapshots ss
      where ss.campaign_id = c.id
        and c.tiktok_sound_id is not null
        and ss.sound_id = c.tiktok_sound_id
    ), '[]'::jsonb),
    'campaign_snapshots', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'captured_at', cs.captured_at,
          'views', cs.views,
          'likes', cs.likes,
          'comments', cs.comments,
          'shares', cs.shares,
          'engagement_rate', cs.engagement_rate
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

comment on function private.fetch_shared_report_impl(text) is
  'Unexposed privileged reader for token-gated active campaign reports; returns client-visible metrics with provider freshness dates.';
