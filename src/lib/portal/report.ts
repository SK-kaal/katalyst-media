import type { CampaignStatus } from "@/lib/supabase/database.types";

export type ReportCampaign = {
  status: CampaignStatus;
  budget: number;
  display_title: string | null;
  tiktok_sound_url: string | null;
  sound_title: string | null;
  sound_artist: string | null;
  artwork_url: string | null;
  sound_artwork_url: string | null;
  sound_usage_count: number | null;
  target_posts: number;
};

export type ReportClient = {
  name: string;
  handle: string | null;
  profile_image_url: string | null;
};

export type ReportPost = {
  id: string;
  post_url: string;
  title: string | null;
  creator_handle: string;
  creator_display_name: string | null;
  thumbnail_url: string | null;
  posted_at: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  created_at: string;
};

export type ReportPostSnapshot = {
  post_id: string;
  captured_at: string;
  views: number;
};

export type ReportSoundSnapshot = {
  captured_at: string;
  creation_count: number;
};

export type ReportCampaignSnapshot = {
  captured_at: string;
  views: number;
};

export type SharedReport = {
  campaign: ReportCampaign;
  client: ReportClient;
  posts: ReportPost[];
  snapshots?: ReportPostSnapshot[];
  sound_snapshots?: ReportSoundSnapshot[];
  campaign_snapshots?: ReportCampaignSnapshot[];
};
