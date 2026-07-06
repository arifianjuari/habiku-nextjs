import { createClient } from "@/lib/supabase/client";
import type { ChildProfile, Goal, Task } from "@/types/database";
import type { PendingTaskRequest } from "@/lib/parent/fetch-family-page-data";
import { enrichPockets } from "@/lib/savings/enrich-pockets";
import { fetchParentGoldSavingsData } from "@/lib/gold/fetch-gold";
import type {
  GoalClaimPending,
  ParentSavingsData,
  SavingsPocketRow,
  SavingsPocketWithBalance,
  SavingsWithdrawPending,
} from "@/lib/savings/types";
import type { AppSupabaseClient } from "@/lib/supabase/types";

function buildSavableByProfile(
  profileIds: string[],
  goalRows: { profile_id: string; current_hp: number }[] | null,
): Record<string, number> {
  const savableByProfile = Object.fromEntries(profileIds.map((id) => [id, 0]));

  for (const row of goalRows ?? []) {
    savableByProfile[row.profile_id] =
      (savableByProfile[row.profile_id] ?? 0) + row.current_hp;
  }

  return savableByProfile;
}

export async function fetchFamilyChildrenClient(
  familyId: string,
  supabase?: AppSupabaseClient,
): Promise<ChildProfile[]> {
  const client = supabase ?? createClient();
  const { data } = await client
    .from("child_profiles")
    .select("*")
    .eq("family_id", familyId)
    .is("archived_at", null)
    .order("name", { ascending: true });

  return data ?? [];
}

export async function fetchFamilyTasksClient(
  familyId: string,
  childIds?: string[],
  supabase?: AppSupabaseClient,
): Promise<Task[]> {
  const client = supabase ?? createClient();
  const ids = childIds ?? (await fetchFamilyChildrenClient(familyId, client)).map((c) => c.id);

  if (ids.length === 0) return [];

  const { data: tasks } = await client
    .from("tasks")
    .select("*")
    .in("profile_id", ids)
    .order("created_at", { ascending: false });

  return (tasks ?? []) as Task[];
}

export async function fetchFamilyGoalsClient(
  familyId: string,
  childIds?: string[],
  supabase?: AppSupabaseClient,
): Promise<Goal[]> {
  const client = supabase ?? createClient();
  const ids = childIds ?? (await fetchFamilyChildrenClient(familyId, client)).map((c) => c.id);

  if (ids.length === 0) return [];

  const { data: goals } = await client
    .from("goals")
    .select("*")
    .in("profile_id", ids)
    .order("created_at", { ascending: false });

  return goals ?? [];
}

export async function fetchFamilyChildrenAndTasksClient(
  familyId: string,
): Promise<{ children: ChildProfile[]; tasks: Task[] }> {
  const supabase = createClient();
  const children = await fetchFamilyChildrenClient(familyId, supabase);
  const tasks = await fetchFamilyTasksClient(
    familyId,
    children.map((c) => c.id),
    supabase,
  );

  return { children, tasks };
}

export async function fetchFamilyChildrenAndGoalsClient(
  familyId: string,
): Promise<{ children: ChildProfile[]; goals: Goal[] }> {
  const supabase = createClient();
  const children = await fetchFamilyChildrenClient(familyId, supabase);
  const goals = await fetchFamilyGoalsClient(
    familyId,
    children.map((c) => c.id),
    supabase,
  );

  return { children, goals };
}

export async function fetchPendingTaskRequestsClient(
  familyId: string,
  children?: Pick<ChildProfile, "id" | "name">[],
): Promise<PendingTaskRequest[]> {
  const supabase = createClient();
  const childList =
    children ??
    ((await supabase
      .from("child_profiles")
      .select("id, name")
      .eq("family_id", familyId)
      .is("archived_at", null)).data ?? []);

  const childIds = childList.map((c) => c.id);
  if (childIds.length === 0) return [];

  const nameById = new Map(childList.map((c) => [c.id, c.name]));

  const { data: requests } = await supabase
    .from("task_requests")
    .select("*")
    .in("profile_id", childIds)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  return (requests ?? []).map((request) => ({
    ...(request as PendingTaskRequest),
    child_name: nameById.get(request.profile_id) ?? "Anak",
  }));
}

export async function fetchParentSavingsDataClient(
  familyId: string,
): Promise<ParentSavingsData> {
  const supabase = createClient();

  const [children, settingsResult] = await Promise.all([
    fetchFamilyChildrenClient(familyId, supabase),
    supabase
      .from("family_settings")
      .select(
        "savings_enabled, goal_save_enabled, max_monthly_interest_bps, gold_savings_enabled, gold_sell_price_energy, gold_buy_price_energy, gold_unit_label",
      )
      .eq("family_id", familyId)
      .maybeSingle(),
  ]);

  const profileIds = children.map((c) => c.id);
  const settingsRow = settingsResult.data;
  const savingsEnabled = settingsRow?.savings_enabled ?? true;
  const goalSaveEnabled = settingsRow?.goal_save_enabled ?? true;
  const maxMonthlyInterestBps = settingsRow?.max_monthly_interest_bps ?? 500;
  const goldEnabled = settingsRow?.gold_savings_enabled ?? false;

  const emptyGold = await fetchParentGoldSavingsData(
    supabase,
    familyId,
    profileIds,
    settingsRow,
  );

  const empty: ParentSavingsData = {
    children,
    pocketsByProfile: {},
    savableByProfile: {},
    pendingWithdrawals: [],
    pendingGoalClaims: [],
    savingsEnabled,
    goalSaveEnabled,
    maxMonthlyInterestBps,
    gold: emptyGold,
  };

  if (profileIds.length === 0) return empty;

  const [pocketsResult, pendingResult, claimsResult, goalsResult, gold] = await Promise.all([
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
    supabase
      .from("goals")
      .select("profile_id, current_hp")
      .in("profile_id", profileIds)
      .eq("status", "active"),
    goldEnabled
      ? fetchParentGoldSavingsData(supabase, familyId, profileIds, settingsRow)
      : Promise.resolve(emptyGold),
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

  const savableByProfile = buildSavableByProfile(
    profileIds,
    (goalsResult.data ?? []) as { profile_id: string; current_hp: number }[],
  );

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
    gold,
  };
}
