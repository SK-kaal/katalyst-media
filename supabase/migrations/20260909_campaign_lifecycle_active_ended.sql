-- Permanent client-link lifecycle: active | ended
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS ended_at timestamptz;

ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_status_check;

UPDATE public.campaigns
SET share_token = encode(gen_random_bytes(24), 'hex')
WHERE share_token IS NULL OR length(trim(share_token)) < 20;

UPDATE public.campaigns
SET status = 'active'
WHERE status IN ('draft', 'live', 'paused', 'in_progress');

UPDATE public.campaigns
SET
  status = 'ended',
  ended_at = COALESCE(ended_at, updated_at, now())
WHERE status = 'closed';

UPDATE public.campaigns
SET
  status = 'ended',
  ended_at = COALESCE(ended_at, now())
WHERE share_enabled = false
  AND trashed_at IS NULL
  AND status = 'active';

UPDATE public.campaigns
SET share_enabled = (status = 'active' AND trashed_at IS NULL);

ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_status_check
  CHECK (status IN ('active', 'ended'));

ALTER TABLE public.campaigns
  ALTER COLUMN status SET DEFAULT 'active';

ALTER TABLE public.campaigns
  ALTER COLUMN share_token SET NOT NULL;

CREATE OR REPLACE FUNCTION public.fetch_shared_report(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  result jsonb;
begin
  if p_token is null or length(trim(p_token)) < 20 then
    return null;
  end if;

  select jsonb_build_object(
    'campaign', to_jsonb(c),
    'client', to_jsonb(cl),
    'posts', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.views desc)
      from public.tiktok_posts p
      where p.campaign_id = c.id
    ), '[]'::jsonb),
    'snapshots', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.captured_at asc)
      from public.post_metric_snapshots s
      join public.tiktok_posts p on p.id = s.post_id
      where p.campaign_id = c.id
    ), '[]'::jsonb),
    'sound_snapshots', coalesce((
      select jsonb_agg(to_jsonb(ss) order by ss.captured_at asc)
      from public.sound_metric_snapshots ss
      where ss.campaign_id = c.id
    ), '[]'::jsonb),
    'campaign_snapshots', coalesce((
      select jsonb_agg(to_jsonb(cs) order by cs.captured_at asc)
      from public.campaign_metric_snapshots cs
      where cs.campaign_id = c.id
    ), '[]'::jsonb),
    'daily', coalesce((
      select jsonb_agg(to_jsonb(d) order by d.date asc)
      from public.campaign_daily_performance d
      where d.campaign_id = c.id
    ), '[]'::jsonb)
  )
  into result
  from public.campaigns c
  join public.clients cl on cl.id = c.client_id
  where c.share_token = p_token
    and c.status = 'active'
    and c.trashed_at is null
  limit 1;

  return result;
end;
$function$;
