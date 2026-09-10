-- Target posts + historical sound/campaign snapshots
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS target_posts integer;

COMMENT ON COLUMN public.campaigns.target_posts IS
  'Manual Katalyst campaign delivery goal. Distinct from TikTok Creations (sound_usage_count).';

CREATE TABLE IF NOT EXISTS public.sound_metric_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  sound_id text,
  creation_count bigint NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sound_metric_snapshots_campaign_captured_idx
  ON public.sound_metric_snapshots (campaign_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS public.campaign_metric_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  tracked_posts integer NOT NULL DEFAULT 0,
  views bigint NOT NULL DEFAULT 0,
  likes bigint NOT NULL DEFAULT 0,
  comments bigint NOT NULL DEFAULT 0,
  shares bigint NOT NULL DEFAULT 0,
  engagement_rate numeric NOT NULL DEFAULT 0,
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS campaign_metric_snapshots_campaign_captured_idx
  ON public.campaign_metric_snapshots (campaign_id, captured_at DESC);
