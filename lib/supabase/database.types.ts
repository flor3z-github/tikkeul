// Minimal hand-written DB types for the MVP. Replace with `supabase gen types`
// output once you set up the Supabase CLI. Only tables/columns used by Phase B.

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      user_settings: {
        Row: {
          user_id: string;
          monthly_income: number;
          cycle_mode: "calendar" | "income_day";
          cycle_start_day: number;
          friend_spending_notifications: boolean;
          transaction_interaction_notifications: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          monthly_income?: number;
          cycle_mode?: "calendar" | "income_day";
          cycle_start_day?: number;
          friend_spending_notifications?: boolean;
          transaction_interaction_notifications?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          monthly_income?: number;
          cycle_mode?: "calendar" | "income_day";
          cycle_start_day?: number;
          friend_spending_notifications?: boolean;
          transaction_interaction_notifications?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      subscription_plans: {
        Row: {
          id: string;
          service_name: string;
          plan_name: string | null;
          default_amount: number;
          category: string | null;
          sort_order: number;
          aliases: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          service_name: string;
          plan_name?: string | null;
          default_amount: number;
          category?: string | null;
          sort_order?: number;
          aliases?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          service_name?: string;
          plan_name?: string | null;
          default_amount?: number;
          category?: string | null;
          sort_order?: number;
          aliases?: string[];
          created_at?: string;
        };
        Relationships: [];
      };
      fixed_expenses: {
        Row: {
          id: string;
          user_id: string;
          subscription_plan_id: string | null;
          name: string;
          plan_name: string | null;
          amount: number;
          category: string | null;
          is_active: boolean;
          payment_day: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          subscription_plan_id?: string | null;
          name: string;
          plan_name?: string | null;
          amount: number;
          category?: string | null;
          is_active?: boolean;
          payment_day?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          subscription_plan_id?: string | null;
          name?: string;
          plan_name?: string | null;
          amount?: number;
          category?: string | null;
          is_active?: boolean;
          payment_day?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fixed_expenses_subscription_plan_id_fkey";
            columns: ["subscription_plan_id"];
            isOneToOne: false;
            referencedRelation: "subscription_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          id: string;
          user_id: string | null;
          name: string;
          color: string | null;
          icon: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          name: string;
          color?: string | null;
          icon?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          name?: string;
          color?: string | null;
          icon?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          category_id: string | null;
          spent_at: string;
          memo: string | null;
          visibility: "all" | "groups" | "private";
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          amount: number;
          category_id?: string | null;
          spent_at: string;
          memo?: string | null;
          visibility?: "all" | "groups" | "private";
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          amount?: number;
          category_id?: string | null;
          spent_at?: string;
          memo?: string | null;
          visibility?: "all" | "groups" | "private";
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      friend_groups: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          slug: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          slug?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          slug?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      friend_group_members: {
        Row: {
          group_id: string;
          member_user_id: string;
          added_at: string;
        };
        Insert: {
          group_id: string;
          member_user_id: string;
          added_at?: string;
        };
        Update: {
          group_id?: string;
          member_user_id?: string;
          added_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "friend_group_members_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "friend_groups";
            referencedColumns: ["id"];
          },
        ];
      };
      transaction_visibility_groups: {
        Row: {
          transaction_id: string;
          group_id: string;
        };
        Insert: {
          transaction_id: string;
          group_id: string;
        };
        Update: {
          transaction_id?: string;
          group_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transaction_visibility_groups_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transaction_visibility_groups_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "friend_groups";
            referencedColumns: ["id"];
          },
        ];
      };
      friend_codes: {
        Row: {
          code: string;
          owner_id: string;
          expires_at: string;
          used_at: string | null;
          used_by: string | null;
          created_at: string;
        };
        Insert: {
          code: string;
          owner_id: string;
          expires_at: string;
          used_at?: string | null;
          used_by?: string | null;
          created_at?: string;
        };
        Update: {
          code?: string;
          owner_id?: string;
          expires_at?: string;
          used_at?: string | null;
          used_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      friendships: {
        Row: {
          id: string;
          owner_id: string;
          viewer_id: string;
          show_spending_total: boolean;
          show_spending_items: boolean;
          show_fixed_total: boolean;
          show_fixed_items: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          viewer_id: string;
          show_spending_total?: boolean;
          show_spending_items?: boolean;
          show_fixed_total?: boolean;
          show_fixed_items?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          viewer_id?: string;
          show_spending_total?: boolean;
          show_spending_items?: boolean;
          show_fixed_total?: boolean;
          show_fixed_items?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      redeem_attempts: {
        Row: {
          id: number;
          user_id: string;
          attempted_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          attempted_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          attempted_at?: string;
        };
        Relationships: [];
      };
      dm_threads: {
        Row: {
          id: string;
          user_a_id: string;
          user_b_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_a_id: string;
          user_b_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_a_id?: string;
          user_b_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      dm_messages: {
        Row: {
          id: string;
          thread_id: string;
          sender_id: string;
          content: string;
          quoted_transaction_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          thread_id: string;
          sender_id: string;
          content: string;
          quoted_transaction_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          thread_id?: string;
          sender_id?: string;
          content?: string;
          quoted_transaction_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dm_messages_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "dm_threads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dm_messages_quoted_transaction_id_fkey";
            columns: ["quoted_transaction_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
        ];
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent: string | null;
          created_at: string;
          last_seen_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent?: string | null;
          created_at?: string;
          last_seen_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          user_agent?: string | null;
          created_at?: string;
          last_seen_at?: string;
        };
        Relationships: [];
      };
      income_adjustments: {
        Row: {
          id: string;
          user_id: string;
          occurred_on: string;
          amount: number;
          memo: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          occurred_on: string;
          amount: number;
          memo?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          occurred_on?: string;
          amount?: number;
          memo?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      redeem_friend_code: {
        Args: { p_code: string };
        Returns: string;
      };
      get_user_cycle: {
        Args: { target: string };
        Returns: {
          cycle_mode: "calendar" | "income_day";
          cycle_start_day: number;
        }[];
      };
      delete_category: {
        Args: { p_id: string };
        Returns: undefined;
      };
      get_user_categories: {
        Args: { target: string };
        Returns: {
          id: string;
          name: string;
          icon: string | null;
          color: string | null;
        }[];
      };
      get_friend_spending_total: {
        Args: { target: string; start_iso: string; end_iso: string };
        Returns: number;
      };
      create_transaction_with_visibility: {
        Args: {
          p_id: string;
          p_amount: number;
          p_category_id: string | null;
          p_spent_at: string;
          p_memo: string | null;
          p_visibility: "all" | "groups" | "private";
          p_group_ids: string[] | null;
        };
        Returns: undefined;
      };
      update_transaction_with_visibility: {
        Args: {
          p_id: string;
          p_amount: number;
          p_category_id: string | null;
          p_spent_at: string;
          p_memo: string | null;
          p_visibility: "all" | "groups" | "private";
          p_group_ids: string[] | null;
        };
        Returns: undefined;
      };
      get_friend_fixed_total: {
        Args: { target: string };
        Returns: number;
      };
      get_or_create_dm_thread: {
        Args: { target: string };
        Returns: string;
      };
      mark_dm_thread_read: {
        Args: { p_thread_id: string };
        Returns: undefined;
      };
      get_my_dm_index: {
        Args: Record<string, never>;
        Returns: {
          friend_id: string;
          nickname: string;
          thread_id: string | null;
          last_message_id: string | null;
          last_message_content: string | null;
          last_message_sender_id: string | null;
          last_message_at: string | null;
          unread: number;
        }[];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
