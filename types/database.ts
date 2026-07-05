/**
 * Tipe database Habiku (manual dari docs/database-architecture.md).
 * Setelah migrasi Supabase tersedia, ganti dengan:
 *   supabase gen types typescript --linked > types/database.ts
 */

import type {
  AccountRole,
  FrequencyType,
  GoalStatus,
  GoalVisualState,
  LedgerType,
  NotificationRecipientType,
  ReflectionMood,
  RequestStatus,
  TaskCategory,
  TaskHistoryStatus,
} from "@/lib/database/enums";

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
      families: {
        Row: {
          id: string;
          name: string;
          timezone: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name?: string;
          timezone?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["families"]["Insert"]>;
        Relationships: [];
      };
      accounts: {
        Row: {
          id: string;
          family_id: string;
          role: AccountRole;
          display_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          family_id: string;
          role: AccountRole;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["accounts"]["Insert"]>;
        Relationships: [];
      };
      child_profiles: {
        Row: {
          id: string;
          family_id: string;
          name: string;
          pin_hash: string;
          avatar_url: string | null;
          avatar_preference: string;
          avatar_emoji: string | null;
          date_of_birth: string | null;
          gender: string | null;
          home_card_accent: string;
          featured_task_id: string | null;
          attr_discipline: number;
          attr_responsibility: number;
          attr_independence: number;
          attr_care: number;
          attr_honesty: number;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["child_profiles"]["Row"],
          "id" | "created_at" | "updated_at"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["child_profiles"]["Insert"]>;
        Relationships: [];
      };
      goals: {
        Row: {
          id: string;
          profile_id: string;
          title: string;
          image_url: string | null;
          target_hp: number;
          current_hp: number;
          status: GoalStatus;
          visual_state: GoalVisualState;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["goals"]["Row"],
          "id" | "current_hp" | "created_at" | "updated_at"
        > & {
          id?: string;
          current_hp?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["goals"]["Insert"]>;
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          profile_id: string;
          title: string;
          category: TaskCategory;
          reward_points: number;
          frequency_type: FrequencyType;
          frequency_config: Json;
          max_submissions_per_period: number;
          linked_attribute: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["tasks"]["Row"],
          "id" | "created_at" | "updated_at"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tasks"]["Insert"]>;
        Relationships: [];
      };
      task_history: {
        Row: {
          id: string;
          task_id: string;
          profile_id: string;
          status: TaskHistoryStatus;
          evidence_url: string | null;
          notes: string | null;
          completed_at: string;
          period_date: string | null;
          approved_at: string | null;
          approved_by_account_id: string | null;
          rejected_at: string | null;
          rejected_by_account_id: string | null;
          rejection_reason: string | null;
          missed_at: string | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["task_history"]["Row"],
          "id" | "created_at"
        > & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["task_history"]["Insert"]>;
        Relationships: [];
      };
      point_ledger: {
        Row: {
          id: string;
          profile_id: string;
          account_id: string | null;
          amount: number;
          type: LedgerType;
          task_history_id: string | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["point_ledger"]["Row"],
          "id" | "created_at"
        > & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["point_ledger"]["Insert"]>;
        Relationships: [];
      };
      goal_progress_events: {
        Row: {
          id: string;
          profile_id: string;
          goal_id: string;
          ledger_id: string;
          amount: number;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["goal_progress_events"]["Row"],
          "id" | "created_at"
        > & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["goal_progress_events"]["Insert"]
        >;
        Relationships: [];
      };
      streaks: {
        Row: {
          id: string;
          profile_id: string;
          task_category: TaskCategory;
          current_streak: number;
          best_streak: number;
          last_completed_date: string | null;
          is_recovery_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["streaks"]["Row"],
          "id" | "created_at" | "updated_at"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["streaks"]["Insert"]>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          recipient_id: string;
          recipient_type: NotificationRecipientType;
          type: string;
          content: string;
          is_read: boolean;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["notifications"]["Row"],
          "id" | "created_at"
        > & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
        Relationships: [];
      };
      family_invites: {
        Row: {
          id: string;
          family_id: string;
          token: string;
          expires_at: string;
          created_by: string;
          consumed_at: string | null;
        };
        Insert: Omit<
          Database["public"]["Tables"]["family_invites"]["Row"],
          "id"
        > & { id?: string };
        Update: Partial<Database["public"]["Tables"]["family_invites"]["Insert"]>;
        Relationships: [];
      };
      account_push_tokens: {
        Row: {
          account_id: string;
          expo_push_token: string;
          platform: string | null;
          updated_at: string;
        };
        Insert: Database["public"]["Tables"]["account_push_tokens"]["Row"];
        Update: Partial<
          Database["public"]["Tables"]["account_push_tokens"]["Insert"]
        >;
        Relationships: [];
      };
      savings_pockets: {
        Row: {
          id: string;
          profile_id: string;
          name: string;
          emoji: string;
          accent_color: string;
          target_amount: number | null;
          is_active: boolean;
          created_by_account_id: string | null;
          created_at: string;
          pocket_type: "flexible" | "term";
          monthly_interest_bps: number;
          lock_months: number | null;
          lock_bonus_coefficient: number;
          default_for_goal_save: boolean;
        };
        Insert: Omit<
          Database["public"]["Tables"]["savings_pockets"]["Row"],
          "id" | "created_at"
        > & { id?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["savings_pockets"]["Insert"]>;
        Relationships: [];
      };
      savings_transactions: {
        Row: {
          id: string;
          pocket_id: string;
          profile_id: string;
          kind: "deposit" | "withdraw" | "interest";
          amount: number;
          ledger_id: string | null;
          withdraw_status: "pending" | "approved" | "rejected" | null;
          note: string | null;
          requested_by_account_id: string | null;
          reviewed_by_account_id: string | null;
          reviewed_at: string | null;
          created_at: string;
          locked_until: string | null;
          interest_accrued: number;
          principal_snapshot: number | null;
          last_interest_at: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      family_settings: {
        Row: {
          family_id: string;
          micro_anim_enabled: boolean;
          featured_multiplier: string;
          daily_tip_enabled: boolean;
          show_sibling_highlight: boolean;
          check_in_reminder_enabled: boolean;
          family_garden_enabled: boolean;
          savings_enabled: boolean;
          goal_save_enabled: boolean;
          savings_interest_enabled: boolean;
          max_monthly_interest_bps: number;
          gold_savings_enabled: boolean;
          gold_sell_price_energy: number;
          gold_buy_price_energy: number;
          gold_unit_label: string;
          daily_check_in_bonus: number;
          shared_family_goal_title: string | null;
          shared_family_goal_target_points: number | null;
          shared_family_goal_celebration_dismissed: boolean;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: Omit<
          Database["public"]["Tables"]["family_settings"]["Row"],
          "updated_at"
        > & { updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["family_settings"]["Insert"]>;
        Relationships: [];
      };
      daily_check_ins: {
        Row: {
          id: string;
          profile_id: string;
          check_in_date: string;
          bonus_awarded: number;
          ledger_id: string;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["daily_check_ins"]["Row"],
          "id" | "created_at"
        > & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["daily_check_ins"]["Insert"]>;
        Relationships: [];
      };
      child_badges: {
        Row: {
          id: string;
          profile_id: string;
          badge_key: string;
          awarded_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["child_badges"]["Row"],
          "id"
        > & { id?: string };
        Update: Partial<Database["public"]["Tables"]["child_badges"]["Insert"]>;
        Relationships: [];
      };
      learning_tips: {
        Row: {
          id: string;
          family_id: string;
          emoji: string | null;
          title: string;
          body: string;
          is_active: boolean;
          weight: number;
          created_by: string | null;
        };
        Insert: Omit<
          Database["public"]["Tables"]["learning_tips"]["Row"],
          "id"
        > & { id?: string };
        Update: Partial<Database["public"]["Tables"]["learning_tips"]["Insert"]>;
        Relationships: [];
      };
      child_daily_reflections: {
        Row: {
          id: string;
          profile_id: string;
          reflection_date: string;
          mood: ReflectionMood;
          note: string | null;
        };
        Insert: Omit<
          Database["public"]["Tables"]["child_daily_reflections"]["Row"],
          "id"
        > & { id?: string };
        Update: Partial<
          Database["public"]["Tables"]["child_daily_reflections"]["Insert"]
        >;
        Relationships: [];
      };
      incidental_rewards: {
        Row: {
          id: string;
          profile_id: string;
          granted_by_account_id: string;
          title: string;
          note: string | null;
          category: TaskCategory;
          hp_to_target: number;
          energy_only: number;
          goal_id: string | null;
          hp_ledger_id: string | null;
          energy_ledger_id: string | null;
        };
        Insert: Omit<
          Database["public"]["Tables"]["incidental_rewards"]["Row"],
          "id"
        > & { id?: string };
        Update: Partial<
          Database["public"]["Tables"]["incidental_rewards"]["Insert"]
        >;
        Relationships: [];
      };
      goal_requests: {
        Row: {
          id: string;
          profile_id: string;
          status: RequestStatus;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["goal_requests"]["Row"],
          "id" | "created_at"
        > & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["goal_requests"]["Insert"]>;
        Relationships: [];
      };
      task_requests: {
        Row: {
          id: string;
          profile_id: string;
          title: string;
          note: string | null;
          requested_reward_points: number;
          requested_frequency_type: FrequencyType;
          requested_max_submissions_per_period: number;
          status: RequestStatus;
          created_task_id: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["task_requests"]["Row"],
          "id" | "created_at" | "updated_at"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["task_requests"]["Insert"]>;
        Relationships: [];
      };
      goal_claim_requests: {
        Row: {
          id: string;
          goal_id: string;
          profile_id: string;
          kind: "redeem" | "save";
          status: "pending" | "approved" | "rejected";
          requested_by_account_id: string | null;
          reviewed_by_account_id: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["goal_claim_requests"]["Row"],
          "id" | "created_at"
        > & { id?: string; created_at?: string };
        Update: Partial<
          Database["public"]["Tables"]["goal_claim_requests"]["Insert"]
        >;
        Relationships: [];
      };
      gold_holdings: {
        Row: {
          profile_id: string;
          quantity_milli: number;
          updated_at: string;
        };
        Insert: Database["public"]["Tables"]["gold_holdings"]["Row"];
        Update: Partial<Database["public"]["Tables"]["gold_holdings"]["Insert"]>;
        Relationships: [];
      };
      gold_transactions: {
        Row: {
          id: string;
          profile_id: string;
          kind: "buy" | "sell";
          quantity_milli: number;
          energy_amount: number;
          unit_price_energy: number;
          ledger_id: string | null;
          status: "pending" | "approved" | "rejected";
          reviewed_by_account_id: string | null;
          reviewed_at: string | null;
          note: string | null;
          created_by_account_id: string | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["gold_transactions"]["Row"],
          "id" | "created_at"
        > & { id?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["gold_transactions"]["Insert"]>;
        Relationships: [];
      };
      goal_hp_transfers: {
        Row: {
          id: string;
          profile_id: string;
          from_goal_id: string;
          to_goal_id: string;
          amount: number;
          initiated_by_account_id: string;
          note: string | null;
        };
        Insert: Omit<
          Database["public"]["Tables"]["goal_hp_transfers"]["Row"],
          "id"
        > & { id?: string };
        Update: Partial<
          Database["public"]["Tables"]["goal_hp_transfers"]["Insert"]
        >;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    CompositeTypes: Record<string, never>;
    Enums: {
      account_role: AccountRole;
      goal_status: GoalStatus;
      frequency_type: FrequencyType;
      task_category: TaskCategory;
      ledger_type: LedgerType;
      task_history_status: TaskHistoryStatus;
      notification_recipient_type: NotificationRecipientType;
      reflection_mood: ReflectionMood;
      gold_tx_kind: "buy" | "sell";
      gold_tx_status: "pending" | "approved" | "rejected";
    };
  };
};

/** Alias baris tabel yang sering dipakai di UI */
export type Account = Database["public"]["Tables"]["accounts"]["Row"];
export type ChildProfile = Database["public"]["Tables"]["child_profiles"]["Row"];
export type Family = Database["public"]["Tables"]["families"]["Row"];
export type FamilySettings = Database["public"]["Tables"]["family_settings"]["Row"];
export type Goal = Database["public"]["Tables"]["goals"]["Row"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type TaskRequest = Database["public"]["Tables"]["task_requests"]["Row"];
export type TaskHistory = Database["public"]["Tables"]["task_history"]["Row"];
export type Streak = Database["public"]["Tables"]["streaks"]["Row"];
