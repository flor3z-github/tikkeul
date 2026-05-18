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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          monthly_income?: number;
          cycle_mode?: "calendar" | "income_day";
          cycle_start_day?: number;
          friend_spending_notifications?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          monthly_income?: number;
          cycle_mode?: "calendar" | "income_day";
          cycle_start_day?: number;
          friend_spending_notifications?: boolean;
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
      get_friend_spending_total: {
        Args: { target: string; start_iso: string; end_iso: string };
        Returns: number;
      };
      get_friend_fixed_total: {
        Args: { target: string };
        Returns: number;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
