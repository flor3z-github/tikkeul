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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          monthly_income?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          monthly_income?: number;
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
          created_at: string;
        };
        Insert: {
          id?: string;
          service_name: string;
          plan_name?: string | null;
          default_amount: number;
          category?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          service_name?: string;
          plan_name?: string | null;
          default_amount?: number;
          category?: string | null;
          sort_order?: number;
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
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
