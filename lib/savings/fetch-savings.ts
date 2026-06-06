import { createClient } from "@/lib/supabase/server";
import { RPC } from "@/lib/database/rpc";
import { fetchFamilyChildren } from "@/lib/parent/fetch-family-page-data";
import { projectedInterestTotal } from "@/lib/savings/interest";
import type {
  ChildSavingsData,
  GoalClaimPending,
  ParentSavingsData,
  SavingsPocketRow,
  SavingsPocketWithBalance,
  SavingsWithdrawPending,
} from "@/lib/savings/types";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

async function rpcNumber(
  supabase: SupabaseServer,
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
  supabase: SupabaseServer,
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

async function enrichPockets(
  supabase: SupabaseServer,
  pockets: SavingsPocketRow[],
): Promise<SavingsPocketWithBalance[]> {
  return Promise.all(
    pockets.map(async (pocket) => {
      const [balance, reserved, isLocked] = await Promise.all([
        rpcNumber(supabase, RPC.computeSavingsPocketBalance, {
          p_pocket_id: pocket.id,
        }),
        rpcNumber(supabase, "compute_savings_reserved_balance", {
          p_pocket_id: pocket.id,
        }),
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
      const interestAccrued = latestDeposit?.interest_accrued ?? 0;

      return {
        ...pocket,
        balance,
        reserved,
        is_locked: isLocked,
        locked_until: latestDeposit?.locked_until ?? null,
        interest_accrued: interestAccrued,
        projected_interest: projectedInterestTotal(principal, pocket),
      };
    }),
  );
}

export async function fetchParentSavingsData(
  familyId: string,
): Promise<ParentSavingsData> {
  const supabase = await createClient();

  const [children, settingsResult] = await Promise.all([
    fetchFamilyChildren(familyId),
    supabase
      .from("family_settings")
      .select("savings_enabled, goal_save_enabled, max_monthly_interest_bps")
      .eq("family_id", familyId)
      .maybeSingle(),
  ]);

  const profileIds = children.map((c) => c.id);
  const savingsEnabled = settingsResult.data?.savings_enabled ?? true;
  const goalSaveEnabled = settingsResult.data?.goal_save_enabled ?? true;
  const maxMonthlyInterestBps = settingsResult.data?.max_monthly_interest_bps ?? 500;

  const empty: ParentSavingsData = {
    children: [],
    pocketsByProfile: {},
    savableByProfile: {},
    pendingWithdrawals: [],
    pendingGoalClaims: [],
    savingsEnabled,
    goalSaveEnabled,
    maxMonthlyInterestBps,
  };

  if (profileIds.length === 0) return empty;

  const [pocketsResult, pendingResult, claimsResult, ...walletResults] =
    await Promise.all([
      supabase
        .from("savings_pockets")
        .select("*")
        .in("profile_id", profileIds)
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("savings_transactions")
        .select(
          "id, pocket_id, profile_id, amount, note, created_at, savings_pockets(name, emoji), child_profiles(name)",
        )
        .in("profile_id", profileIds)
        .eq("kind", "withdraw")
        .eq("withdraw_status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("goal_claim_requests")
        .select(
          "id, goal_id, profile_id, created_at, goals(title, current_hp), child_profiles(name)",
        )
        .in("profile_id", profileIds)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      ...profileIds.map((id) =>
        rpcNumber(supabase, RPC.computeSavableGoalEnergy, { p_profile_id: id }),
      ),
    ]);

  const pockets = (pocketsResult.data ?? []) as SavingsPocketRow[];
  const enriched = await enrichPockets(supabase, pockets);

  const pocketsByProfile = profileIds.reduce<Record<string, SavingsPocketWithBalance[]>>(
    (acc, id) => {
      acc[id] = enriched.filter((p) => p.profile_id === id);
      return acc;
    },
    {},
  );

  const savableByProfile = profileIds.reduce<Record<string, number>>((acc, id, i) => {
    acc[id] = walletResults[i] ?? 0;
    return acc;
  }, {});

  const pendingWithdrawals: SavingsWithdrawPending[] = (
    pendingResult.data ?? []
  ).map((row) => {
    const r = row as {
      id: string;
      pocket_id: string;
      profile_id: string;
      amount: number;
      note: string | null;
      created_at: string;
      savings_pockets: { name: string; emoji: string } | { name: string; emoji: string }[] | null;
      child_profiles: { name: string } | { name: string }[] | null;
    };
    const pocket = Array.isArray(r.savings_pockets)
      ? r.savings_pockets[0]
      : r.savings_pockets;
    const child = Array.isArray(r.child_profiles)
      ? r.child_profiles[0]
      : r.child_profiles;
    return {
      id: r.id,
      pocket_id: r.pocket_id,
      profile_id: r.profile_id,
      amount: r.amount,
      note: r.note,
      created_at: r.created_at,
      pocket_name: pocket?.name ?? "Kantong",
      pocket_emoji: pocket?.emoji ?? "🐷",
      child_name: child?.name ?? "Anak",
    };
  });

  const pendingGoalClaims: GoalClaimPending[] = (claimsResult.data ?? []).map((row) => {
    const r = row as {
      id: string;
      goal_id: string;
      profile_id: string;
      created_at: string;
      goals: { title: string; current_hp: number } | { title: string; current_hp: number }[] | null;
      child_profiles: { name: string } | { name: string }[] | null;
    };
    const goal = Array.isArray(r.goals) ? r.goals[0] : r.goals;
    const child = Array.isArray(r.child_profiles) ? r.child_profiles[0] : r.child_profiles;
    return {
      id: r.id,
      goal_id: r.goal_id,
      profile_id: r.profile_id,
      goal_title: goal?.title ?? "Target",
      amount: goal?.current_hp ?? 0,
      child_name: child?.name ?? "Anak",
      created_at: r.created_at,
    };
  });

  return {
    children,
    pocketsByProfile,
    savableByProfile,
    pendingWithdrawals,
    pendingGoalClaims,
    savingsEnabled,
    goalSaveEnabled,
    maxMonthlyInterestBps,
  };
}

export async function fetchChildSavingsData(
  profileId: string,
  familyId: string,
): Promise<ChildSavingsData> {
  const supabase = await createClient();

  const [pocketsResult, settingsResult, savableBalance] = await Promise.all([
    supabase
      .from("savings_pockets")
      .select("*")
      .eq("profile_id", profileId)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("family_settings")
      .select("savings_enabled, goal_save_enabled")
      .eq("family_id", familyId)
      .maybeSingle(),
    rpcNumber(supabase, RPC.computeSavableGoalEnergy, { p_profile_id: profileId }),
  ]);

  const pockets = (pocketsResult.data ?? []) as SavingsPocketRow[];
  const enriched = await enrichPockets(supabase, pockets);

  return {
    pockets: enriched,
    savableBalance,
    savingsEnabled: settingsResult.data?.savings_enabled ?? true,
    goalSaveEnabled: settingsResult.data?.goal_save_enabled ?? true,
  };
}
