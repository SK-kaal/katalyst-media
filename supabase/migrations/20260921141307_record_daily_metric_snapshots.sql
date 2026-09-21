-- Metric history powers the client-facing daily charts. The previous unique
-- indexes deduplicated identical metric values forever, so an unchanged post
-- could never produce the next day's zero-growth point. Application code now
-- skips only an unchanged snapshot from the same UK calendar day.
drop index if exists public.post_metric_snapshots_metrics_unique;
drop index if exists public.campaign_metric_snapshots_metrics_unique;
