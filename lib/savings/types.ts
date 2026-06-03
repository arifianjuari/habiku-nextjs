import type { ChildProfile } from "@/types/database";

export type SavingsPocketRow = {
  id: string;
  profile_id: string;
  name: string;
  emoji: string;
  accent_color: string;
  target_amount: number | null;
  is_active: boolean;
  created_at: string;
};

export type SavingsPocketWithBalance = SavingsPocketRow & {
  balance: number;
  reserved: number;
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

export type ParentSavingsData = {
  children: ChildProfile[];
  pocketsByProfile: Record<string, SavingsPocketWithBalance[]>;
  walletByProfile: Record<string, number>;
  pendingWithdrawals: SavingsWithdrawPending[];
  savingsEnabled: boolean;
};

export type ChildSavingsData = {
  pockets: SavingsPocketWithBalance[];
  walletBalance: number;
  savingsEnabled: boolean;
};
