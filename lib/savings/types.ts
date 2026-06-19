import type { ChildProfile } from "@/types/database";
import type { SavingsPocketType } from "@/lib/database/enums";

export type SavingsPocketRow = {
  id: string;
  profile_id: string;
  name: string;
  emoji: string;
  accent_color: string;
  target_amount: number | null;
  is_active: boolean;
  created_at: string;
  pocket_type: SavingsPocketType;
  monthly_interest_bps: number;
  lock_months: number | null;
  lock_bonus_coefficient: number;
  default_for_goal_save: boolean;
};

export type SavingsPocketWithBalance = SavingsPocketRow & {
  balance: number;
  reserved: number;
  is_locked: boolean;
  locked_until: string | null;
  interest_accrued: number;
  projected_interest: number;
};

export type SavingsWithdrawPending = {
  id: string;
  pocket_id: string;
  profile_id: string;
  amount: number;
  note: string | null;
  created_at: string;
  pocket_name: string;
  pocket_emoji: string;
  child_name: string;
};

export type GoalClaimPending = {
  id: string;
  goal_id: string;
  profile_id: string;
  goal_title: string;
  amount: number;
  child_name: string;
  created_at: string;
};

export type ParentSavingsData = {
  children: ChildProfile[];
  pocketsByProfile: Record<string, SavingsPocketWithBalance[]>;
  /** Energi di target aktif yang bisa ditabung (bukan total point_ledger). */
  savableByProfile: Record<string, number>;
  pendingWithdrawals: SavingsWithdrawPending[];
  pendingGoalClaims: GoalClaimPending[];
  savingsEnabled: boolean;
  goalSaveEnabled: boolean;
  maxMonthlyInterestBps: number;
};

export type ChildSavingsData = {
  pockets: SavingsPocketWithBalance[];
  /** Energi di target aktif yang bisa ditabung ke kantong. */
  savableBalance: number;
  /** Saldo dompet (point_ledger); RPC deposit juga memvalidasi ini. */
  walletBalance: number;
  savingsEnabled: boolean;
  goalSaveEnabled: boolean;
};
