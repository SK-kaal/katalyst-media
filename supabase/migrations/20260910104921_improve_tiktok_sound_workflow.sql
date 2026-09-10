-- Keep provider metadata separate from deliberate admin corrections so a
-- partial TikTok refresh can never destroy a good manual value.
alter table public.campaigns
  add column if not exists sound_title_override text,
  add column if not exists sound_artist_override text;

alter table public.campaigns
  drop constraint if exists campaigns_sound_title_override_length_check,
  drop constraint if exists campaigns_sound_artist_override_length_check;

alter table public.campaigns
  add constraint campaigns_sound_title_override_length_check
    check (sound_title_override is null or length(sound_title_override) <= 160),
  add constraint campaigns_sound_artist_override_length_check
    check (sound_artist_override is null or length(sound_artist_override) <= 120);

comment on column public.campaigns.sound_title_override is
  'Optional admin display correction. Null falls back to provider sound_title.';
comment on column public.campaigns.sound_artist_override is
  'Optional admin display correction. Null falls back to provider sound_artist.';

-- Continue returning the same narrow report shape. Overrides are resolved
-- inside the private function, and only snapshots for the currently attached
-- TikTok sound can reach the client report.
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
        and c.tiktok_sound_id is not null
        and ss.sound_id = c.tiktok_sound_id
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
