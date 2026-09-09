export type CampaignStatus = "draft" | "live" | "paused" | "closed";
export type ClientType = "artist" | "manager" | "label";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string;
          name: string;
          handle: string | null;
          profile_image_url: string | null;
          tiktok_profile_url: string | null;
          email: string | null;
          client_type: ClientType;
          internal_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          handle?: string | null;
          profile_image_url?: string | null;
          tiktok_profile_url?: string | null;
          email?: string | null;
          client_type?: ClientType;
          internal_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          handle?: string | null;
          profile_image_url?: string | null;
          tiktok_profile_url?: string | null;
          email?: string | null;
          client_type?: ClientType;
          internal_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      campaigns: {
        Row: {
          id: string;
          client_id: string;
          campaign_name: string;
          release_title: string;
          artwork_url: string | null;
          status: CampaignStatus;
          start_date: string | null;
          end_date: string | null;
          budget: number;
          amount_spent: number;
          share_token: string | null;
          share_enabled: boolean;
          tiktok_sound_url: string | null;
          tiktok_sound_id: string | null;
          sound_title: string | null;
          sound_artist: string | null;
          sound_artwork_url: string | null;
          sound_usage_count: number | null;
          last_synced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          campaign_name: string;
          release_title: string;
          artwork_url?: string | null;
          status?: CampaignStatus;
          start_date?: string | null;
          end_date?: string | null;
          budget?: number;
          amount_spent?: number;
          share_token?: string | null;
          share_enabled?: boolean;
          tiktok_sound_url?: string | null;
          tiktok_sound_id?: string | null;
          sound_title?: string | null;
          sound_artist?: string | null;
          sound_artwork_url?: string | null;
          sound_usage_count?: number | null;
          last_synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          campaign_name?: string;
          release_title?: string;
          artwork_url?: string | null;
          status?: CampaignStatus;
          start_date?: string | null;
          end_date?: string | null;
          budget?: number;
          amount_spent?: number;
          share_token?: string | null;
          share_enabled?: boolean;
          tiktok_sound_url?: string | null;
          tiktok_sound_id?: string | null;
          sound_title?: string | null;
          sound_artist?: string | null;
          sound_artwork_url?: string | null;
          sound_usage_count?: number | null;
          last_synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaigns_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      tiktok_posts: {
        Row: {
          id: string;
          campaign_id: string;
          post_url: string;
          title: string | null;
          creator_handle: string;
          thumbnail_url: string | null;
          posted_at: string | null;
          views: number;
          likes: number;
          comments: number;
          shares: number;
          tiktok_post_id: string | null;
          creator_display_name: string | null;
          last_synced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          post_url: string;
          title?: string | null;
          creator_handle: string;
          thumbnail_url?: string | null;
          posted_at?: string | null;
          views?: number;
          likes?: number;
          comments?: number;
          shares?: number;
          tiktok_post_id?: string | null;
          creator_display_name?: string | null;
          last_synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          post_url?: string;
          title?: string | null;
          creator_handle?: string;
          thumbnail_url?: string | null;
          posted_at?: string | null;
          views?: number;
          likes?: number;
          comments?: number;
          shares?: number;
          tiktok_post_id?: string | null;
          creator_display_name?: string | null;
          last_synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tiktok_posts_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
        ];
      };
      post_metric_snapshots: {
        Row: {
          id: string;
          post_id: string;
          captured_at: string;
          views: number;
          likes: number;
          comments: number;
          shares: number;
        };
        Insert: {
          id?: string;
          post_id: string;
          captured_at?: string;
          views?: number;
          likes?: number;
          comments?: number;
          shares?: number;
        };
        Update: {
          id?: string;
          post_id?: string;
          captured_at?: string;
          views?: number;
          likes?: number;
          comments?: number;
          shares?: number;
        };
        Relationships: [
          {
            foreignKeyName: "post_metric_snapshots_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "tiktok_posts";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_daily_performance: {
        Row: {
          id: string;
          campaign_id: string;
          date: string;
          views: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          date: string;
          views?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          date?: string;
          views?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_daily_performance_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      fetch_shared_report: {
        Args: { p_token: string };
        Returns: Json;
      };
    };
    Enums: {
      campaign_status: CampaignStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Client = Database["public"]["Tables"]["clients"]["Row"];
export type Campaign = Database["public"]["Tables"]["campaigns"]["Row"];
export type TikTokPost = Database["public"]["Tables"]["tiktok_posts"]["Row"];
export type PostMetricSnapshot =
  Database["public"]["Tables"]["post_metric_snapshots"]["Row"];
export type DailyPerformance =
  Database["public"]["Tables"]["campaign_daily_performance"]["Row"];
