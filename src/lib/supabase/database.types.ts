export type CampaignStatus = "active" | "ended";
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
          archived_at: string | null;
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
          archived_at?: string | null;
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
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      campaigns: {
        Row: {
          id: string;
          client_id: string;
          display_title: string | null;
          artwork_url: string | null;
          status: CampaignStatus;
          budget: number;
          /** Manual Katalyst delivery goal — not TikTok Creations */
          target_posts: number;
          share_token: string;
          tiktok_sound_url: string | null;
          tiktok_sound_id: string | null;
          sound_title: string | null;
          sound_artist: string | null;
          sound_artwork_url: string | null;
          sound_usage_count: number | null;
          last_synced_at: string | null;
          trashed_at: string | null;
          ended_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          display_title?: string | null;
          artwork_url?: string | null;
          status?: CampaignStatus;
          budget?: number;
          target_posts: number;
          share_token: string;
          tiktok_sound_url?: string | null;
          tiktok_sound_id?: string | null;
          sound_title?: string | null;
          sound_artist?: string | null;
          sound_artwork_url?: string | null;
          sound_usage_count?: number | null;
          last_synced_at?: string | null;
          trashed_at?: string | null;
          ended_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          display_title?: string | null;
          artwork_url?: string | null;
          status?: CampaignStatus;
          budget?: number;
          target_posts?: number;
          share_token?: string;
          tiktok_sound_url?: string | null;
          tiktok_sound_id?: string | null;
          sound_title?: string | null;
          sound_artist?: string | null;
          sound_artwork_url?: string | null;
          sound_usage_count?: number | null;
          last_synced_at?: string | null;
          trashed_at?: string | null;
          ended_at?: string | null;
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
          last_sync_error: string | null;
          last_sync_status: string | null;
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
          last_sync_error?: string | null;
          last_sync_status?: string | null;
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
          last_sync_error?: string | null;
          last_sync_status?: string | null;
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
      sound_metric_snapshots: {
        Row: {
          id: string;
          campaign_id: string;
          sound_id: string | null;
          creation_count: number;
          captured_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          sound_id?: string | null;
          creation_count: number;
          captured_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          sound_id?: string | null;
          creation_count?: number;
          captured_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sound_metric_snapshots_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_metric_snapshots: {
        Row: {
          id: string;
          campaign_id: string;
          tracked_posts: number;
          views: number;
          likes: number;
          comments: number;
          shares: number;
          engagement_rate: number;
          captured_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          tracked_posts?: number;
          views?: number;
          likes?: number;
          comments?: number;
          shares?: number;
          engagement_rate?: number;
          captured_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          tracked_posts?: number;
          views?: number;
          likes?: number;
          comments?: number;
          shares?: number;
          engagement_rate?: number;
          captured_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_metric_snapshots_campaign_id_fkey";
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
export type SoundMetricSnapshot =
  Database["public"]["Tables"]["sound_metric_snapshots"]["Row"];
export type CampaignMetricSnapshot =
  Database["public"]["Tables"]["campaign_metric_snapshots"]["Row"];
