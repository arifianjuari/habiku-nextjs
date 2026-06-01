import { createClient } from "@/lib/supabase/client";
import { getJakartaTodayString } from "@/lib/child/jakarta-today";
import type { ChildProfile, Goal, Task } from "@/types/database";

type SupabaseClient = ReturnType<typeof createClient>;

/** RPC kustom belum terdaftar di generated Database types. */
function callProfileRpc(supabase: SupabaseClient, fn: string, profileId: string) {
  const client = supabase as unknown as {
    rpc: (
      name: string,
      args: { p_profile_id: string },
    ) => Promise<{ data: unknown; error: unknown }>;
  };
  return client.rpc(fn, { p_profile_id: profileId });
}

export type ChildHomeData = {
  child: ChildProfile | null;
  activeGoal: Goal | null;
  totalPoints: number;
  checkInChain: number;
  isCheckedInToday: boolean;
};

export type TaskWithStatus = Task & {
  submissionsToday: number;
  isCompletedToday: boolean;
  isPendingToday: boolean;
  isFeatured?: boolean;
  featuredMultiplierText?: string;
  featuredMultiplierValue?: number;
};

export type ChildTargetsData = {
  goals: Goal[];
  totalPoints: number;
};

export async function fetchChildPoints(profileId: string): Promise<number> {
  const supabase = createClient();
  const { data: ledger } = await supabase
    .from("point_ledger")
    .select("amount")
    .eq("profile_id", profileId);

  return ledger?.reduce((sum, entry) => sum + entry.amount, 0) ?? 0;
}

export async function fetchChildHomeData(profileId: string): Promise<ChildHomeData> {
  const supabase = createClient();
  const todayStr = getJakartaTodayString();

  const [profileResult, ledgerResult, goalResult, chainResult, checkInResult] =
    await Promise.all([
      supabase.from("child_profiles").select("*").eq("id", profileId).maybeSingle(),
      supabase.from("point_ledger").select("amount").eq("profile_id", profileId),
      supabase
        .from("goals")
        .select("*")
        .eq("profile_id", profileId)
        .eq("status", "active")
        .maybeSingle(),
      callProfileRpc(supabase, "compute_check_in_chain_length", profileId),
      supabase
        .from("daily_check_ins")
        .select("id")
        .eq("profile_id", profileId)
        .eq("check_in_date", todayStr)
        .maybeSingle(),
    ]);

  const totalPoints =
    ledgerResult.data?.reduce((sum, entry) => sum + entry.amount, 0) ?? 0;

  const chainData = chainResult.data;
  const checkInChain =
    !chainResult.error && typeof chainData === "number" ? chainData : 0;

  return {
    child: profileResult.data ?? null,
    activeGoal: goalResult.data ?? null,
    totalPoints,
    checkInChain,
    isCheckedInToday: !!checkInResult.data,
  };
}

export async function fetchChildMissionsData(
  profileId: string,
): Promise<TaskWithStatus[]> {
  const supabase = createClient();
  const todayStr = getJakartaTodayString();

  const [tasksResult, historyResult, featuredResult] = await Promise.all([
    supabase
      .from("tasks")
      .select("*")
      .eq("profile_id", profileId)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("task_history")
      .select("id, task_id, status")
      .eq("profile_id", profileId)
      .eq("period_date", todayStr),
    callProfileRpc(supabase, "compute_featured_task", profileId),
  ]);

  if (tasksResult.error) throw tasksResult.error;
  if (historyResult.error) throw historyResult.error;

  const todayHistory = historyResult.data ?? [];
  const featuredData = featuredResult.data as
    | { task_id: string; multiplier_text: string; multiplier_value: number }[]
    | null;
  const featuredTask =
    featuredData && featuredData.length > 0 ? featuredData[0] : null;

  return (tasksResult.data ?? []).map((task) => {
    const submissions = todayHistory.filter((h) => h.task_id === task.id);
    const isCompleted = submissions.some((h) => h.status === "approved");
    const isPending = submissions.some((h) => h.status === "pending");
    const isFeatured = featuredTask && featuredTask.task_id === task.id;

    return {
      ...task,
      submissionsToday: submissions.length,
      isCompletedToday: isCompleted,
      isPendingToday: isPending,
      isFeatured: !!isFeatured,
      featuredMultiplierText: isFeatured ? featuredTask.multiplier_text : undefined,
      featuredMultiplierValue: isFeatured
        ? Number(featuredTask.multiplier_value)
        : undefined,
    };
  });
}

export async function fetchChildTargetsData(
  profileId: string,
): Promise<ChildTargetsData> {
  const supabase = createClient();

  const [goalsResult, ledgerResult] = await Promise.all([
    supabase
      .from("goals")
      .select("*")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false }),
    supabase.from("point_ledger").select("amount").eq("profile_id", profileId),
  ]);

  const totalPoints =
    ledgerResult.data?.reduce((sum, entry) => sum + entry.amount, 0) ?? 0;

  return {
    goals: goalsResult.data ?? [],
    totalPoints,
  };
}
