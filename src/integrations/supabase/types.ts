export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      email_automation_contacts: {
        Row: {
          contact_name: string | null
          created_at: string | null
          email_address: string
          id: string
          incoming_trigger_id: string | null
          is_active: boolean | null
          monitor_incoming: boolean | null
          monitor_outgoing: boolean | null
          outgoing_trigger_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          contact_name?: string | null
          created_at?: string | null
          email_address: string
          id?: string
          incoming_trigger_id?: string | null
          is_active?: boolean | null
          monitor_incoming?: boolean | null
          monitor_outgoing?: boolean | null
          outgoing_trigger_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          contact_name?: string | null
          created_at?: string | null
          email_address?: string
          id?: string
          incoming_trigger_id?: string | null
          is_active?: boolean | null
          monitor_incoming?: boolean | null
          monitor_outgoing?: boolean | null
          outgoing_trigger_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      google_photos_sync_config: {
        Row: {
          auto_create_memories: boolean
          created_at: string
          id: string
          last_sync_at: string | null
          last_synced_photo_id: string | null
          memories_created_count: number
          photos_synced_count: number
          selected_album_ids: string[] | null
          sync_new_photos: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_create_memories?: boolean
          created_at?: string
          id?: string
          last_sync_at?: string | null
          last_synced_photo_id?: string | null
          memories_created_count?: number
          photos_synced_count?: number
          selected_album_ids?: string[] | null
          sync_new_photos?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_create_memories?: boolean
          created_at?: string
          id?: string
          last_sync_at?: string | null
          last_synced_photo_id?: string | null
          memories_created_count?: number
          photos_synced_count?: number
          selected_album_ids?: string[] | null
          sync_new_photos?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      instagram_automation_config: {
        Row: {
          comments_tracked: number | null
          created_at: string | null
          id: string
          is_active: boolean | null
          last_polled_at: string | null
          likes_tracked: number | null
          monitor_comments: boolean | null
          monitor_likes: boolean | null
          monitor_new_posts: boolean | null
          poll_interval_minutes: number | null
          posts_tracked: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          comments_tracked?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_polled_at?: string | null
          likes_tracked?: number | null
          monitor_comments?: boolean | null
          monitor_likes?: boolean | null
          monitor_new_posts?: boolean | null
          poll_interval_minutes?: number | null
          posts_tracked?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          comments_tracked?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_polled_at?: string | null
          likes_tracked?: number | null
          monitor_comments?: boolean | null
          monitor_likes?: boolean | null
          monitor_new_posts?: boolean | null
          poll_interval_minutes?: number | null
          posts_tracked?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      instagram_processed_engagement: {
        Row: {
          engagement_type: string
          id: string
          instagram_item_id: string
          processed_at: string | null
          user_id: string
        }
        Insert: {
          engagement_type: string
          id?: string
          instagram_item_id: string
          processed_at?: string | null
          user_id: string
        }
        Update: {
          engagement_type?: string
          id?: string
          instagram_item_id?: string
          processed_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      instagram_sync_config: {
        Row: {
          created_at: string
          id: string
          last_sync_at: string | null
          last_synced_post_id: string | null
          memories_created_count: number
          posts_synced_count: number
          sync_comments: boolean
          sync_posts: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_sync_at?: string | null
          last_synced_post_id?: string | null
          memories_created_count?: number
          posts_synced_count?: number
          sync_comments?: boolean
          sync_posts?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_sync_at?: string | null
          last_synced_post_id?: string | null
          memories_created_count?: number
          posts_synced_count?: number
          sync_comments?: boolean
          sync_posts?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      instagram_synced_posts: {
        Row: {
          id: string
          instagram_post_id: string
          memory_id: string | null
          synced_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          instagram_post_id: string
          memory_id?: string | null
          synced_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          instagram_post_id?: string
          memory_id?: string | null
          synced_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      linkedin_automation_config: {
        Row: {
          connections_tracked: number | null
          created_at: string
          id: string
          is_active: boolean | null
          last_polled_at: string | null
          monitor_new_connections: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          connections_tracked?: number | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_polled_at?: string | null
          monitor_new_connections?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          connections_tracked?: number | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_polled_at?: string | null
          monitor_new_connections?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      linkedin_processed_connections: {
        Row: {
          id: string
          linkedin_connection_id: string
          processed_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          linkedin_connection_id: string
          processed_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          linkedin_connection_id?: string
          processed_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      twitter_automation_config: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          last_polled_at: string | null
          likes_tracked: number | null
          monitor_likes: boolean | null
          monitor_new_posts: boolean | null
          monitor_replies: boolean | null
          monitor_retweets: boolean | null
          posts_tracked: number | null
          replies_tracked: number | null
          retweets_tracked: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_polled_at?: string | null
          likes_tracked?: number | null
          monitor_likes?: boolean | null
          monitor_new_posts?: boolean | null
          monitor_replies?: boolean | null
          monitor_retweets?: boolean | null
          posts_tracked?: number | null
          replies_tracked?: number | null
          retweets_tracked?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_polled_at?: string | null
          likes_tracked?: number | null
          monitor_likes?: boolean | null
          monitor_new_posts?: boolean | null
          monitor_replies?: boolean | null
          monitor_retweets?: boolean | null
          posts_tracked?: number | null
          replies_tracked?: number | null
          retweets_tracked?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      twitter_processed_engagement: {
        Row: {
          engagement_type: string
          id: string
          processed_at: string | null
          twitter_item_id: string
          user_id: string
        }
        Insert: {
          engagement_type: string
          id?: string
          processed_at?: string | null
          twitter_item_id: string
          user_id: string
        }
        Update: {
          engagement_type?: string
          id?: string
          processed_at?: string | null
          twitter_item_id?: string
          user_id?: string
        }
        Relationships: []
      }
      twitter_sync_config: {
        Row: {
          created_at: string
          id: string
          last_sync_at: string | null
          last_synced_tweet_id: string | null
          memories_created_count: number
          sync_likes: boolean
          sync_replies: boolean
          sync_retweets: boolean
          sync_tweets: boolean
          tweets_synced_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_sync_at?: string | null
          last_synced_tweet_id?: string | null
          memories_created_count?: number
          sync_likes?: boolean
          sync_replies?: boolean
          sync_retweets?: boolean
          sync_tweets?: boolean
          tweets_synced_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_sync_at?: string | null
          last_synced_tweet_id?: string | null
          memories_created_count?: number
          sync_likes?: boolean
          sync_replies?: boolean
          sync_retweets?: boolean
          sync_tweets?: boolean
          tweets_synced_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      twitter_synced_posts: {
        Row: {
          id: string
          memory_id: string | null
          synced_at: string | null
          twitter_post_id: string
          user_id: string
        }
        Insert: {
          id?: string
          memory_id?: string | null
          synced_at?: string | null
          twitter_post_id: string
          user_id: string
        }
        Update: {
          id?: string
          memory_id?: string | null
          synced_at?: string | null
          twitter_post_id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_api_keys: {
        Row: {
          api_key: string
          created_at: string
          id: string
          private_key: string
          updated_at: string
          user_id: string
          user_key: string
        }
        Insert: {
          api_key: string
          created_at?: string
          id?: string
          private_key: string
          updated_at?: string
          user_id: string
          user_key: string
        }
        Update: {
          api_key?: string
          created_at?: string
          id?: string
          private_key?: string
          updated_at?: string
          user_id?: string
          user_key?: string
        }
        Relationships: []
      }
      user_integrations: {
        Row: {
          account_avatar_url: string | null
          account_email: string | null
          account_name: string | null
          composio_connection_id: string | null
          connected_at: string | null
          created_at: string
          id: string
          integration_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_avatar_url?: string | null
          account_email?: string | null
          account_name?: string | null
          composio_connection_id?: string | null
          connected_at?: string | null
          created_at?: string
          id?: string
          integration_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_avatar_url?: string | null
          account_email?: string | null
          account_name?: string | null
          composio_connection_id?: string | null
          connected_at?: string | null
          created_at?: string
          id?: string
          integration_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      youtube_sync_config: {
        Row: {
          created_at: string
          id: string
          last_sync_at: string | null
          last_synced_video_id: string | null
          memories_created_count: number
          sync_liked_videos: boolean
          sync_subscriptions: boolean
          sync_watch_history: boolean
          updated_at: string
          user_id: string
          videos_synced_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          last_sync_at?: string | null
          last_synced_video_id?: string | null
          memories_created_count?: number
          sync_liked_videos?: boolean
          sync_subscriptions?: boolean
          sync_watch_history?: boolean
          updated_at?: string
          user_id: string
          videos_synced_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          last_sync_at?: string | null
          last_synced_video_id?: string | null
          memories_created_count?: number
          sync_liked_videos?: boolean
          sync_subscriptions?: boolean
          sync_watch_history?: boolean
          updated_at?: string
          user_id?: string
          videos_synced_count?: number
        }
        Relationships: []
      }
      youtube_synced_posts: {
        Row: {
          id: string
          memory_id: string | null
          synced_at: string | null
          user_id: string
          youtube_video_id: string
        }
        Insert: {
          id?: string
          memory_id?: string | null
          synced_at?: string | null
          user_id: string
          youtube_video_id: string
        }
        Update: {
          id?: string
          memory_id?: string | null
          synced_at?: string | null
          user_id?: string
          youtube_video_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
