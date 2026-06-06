import { createClient } from "@/lib/supabase/client";
import { RPC } from "@/lib/database/rpc";
import { projectedInterestTotal } from "@/lib/savings/interest";
import type { ChildSavingsData, SavingsPocketRow } from "@/lib/savings/types";
import type { AppSupabaseClient } from "@/lib/supabase/types";

async function rpcNumber(
  supabase: AppSupabaseClient,
  fn: string,
  args: Record<string, unknown>,
): Promise<number> {
  const { data, error } = await (supabase as unknown as {
    rpc: (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  }).rpc(fn, args);

  if (error || typeof data !== "number") return 0;
  return data;
}

async function rpcBool(
  supabase: AppSupabaseClient,
  fn: string,
  args: Record<string, unknown>,
): Promise<boolean> {
  const { data, error } = await (supabase as unknown as {
    rpc: (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  }).rpc(fn, args);

  if (error || typeof data !== "boolean") return false;
  return data;
}

async function enrichPockets(supabase: AppSupabaseClient, pockets: SavingsPocketRow[]) {
  return Promise.all(
    pockets.map(async (pocket) => {
      const [balance, reserved, isLocked] = await Promise.all([
        rpcNumber(supabase, RPC.computeSavingsPocketBalance, { p_pocket_id: pocket.id }),
        rpcNumber(supabase, "compute_savings_reserved_balance", { p_pocket_id: pocket.id }),
        rpcBool(supabase, "pocket_is_locked", { p_pocket_id: pocket.id }),
      ]);

      const { data: depositRows } = await supabase
        .from("savings_transactions")
        .select("locked_until, interest_accrued, amount")
        .eq("pocket_id", pocket.id)
        .eq("kind", "deposit")
        .order("created_at", { ascending: false })
        .limit(1);

      const latestDeposit = depositRows?.[0] as {
        locked_until: string | null;
        interest_accrued: number;
        amount: number;
      } | undefined;

      const principal = balance > 0 ? balance : (latestDeposit?.amount ?? 0);

      return {
        ...pocket,
        balance,
        reserved,
        is_locked: isLocked,
        locked_until: latestDeposit?.locked_until ?? null,
        interest_accrued: latestDeposit?.interest_accrued ?? 0,
        projected_interest: projectedInterestTotal(principal, pocket),
      };
    }),
  );
}

export async function fetchChildSavingsDataClient(
  profileId: string,
  supabase?: AppSupabaseClient,
): Promise<ChildSavingsData> {
  const client = supabase ?? createClient();

  const { data: child, error: childError } = await client
    .from("child_profiles")
    .select("family_id")
    .eq("id", profileId)
    .maybeSingle();

  if (childError || !child?.family_id) {
    throw new Error("Profil anak tidak ditemukan.");
  }

  const [pocketsResult, settingsResult, savableBalance] = await Promise.all([
    client
      .from("savings_pockets")
      .select("*")
      .eq("profile_id", profileId)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    client
      .from("family_settings")
      .select("savings_enabled, goal_save_enabled")
      .eq("family_id", child.family_id)
      .maybeSingle(),
    rpcNumber(client, RPC.computeSavableGoalEnergy, { p_profile_id: profileId }),
  ]);

  const pockets = (pocketsResult.data ?? []) as SavingsPocketRow[];
  const enriched = await enrichPockets(client, pockets);

  return {
    pockets: enriched,
    savableBalance,
    savingsEnabled: settingsResult.data?.savings_enabled ?? true,
    goalSaveEnabled: settingsResult.data?.goal_save_enabled ?? true,
  };
}
