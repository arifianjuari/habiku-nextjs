import { getChildStickyMessagesAction } from "@/app/child/actions";
import { createClient } from "@/lib/supabase/client";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import { fetchChildEngagement } from "@/lib/child/fetch-child-engagement";
import {
  DEFAULT_CHILD_ENGAGEMENT_SETTINGS,
  type ChildEngagementData,
} from "@/lib/child/engagement-types";
import { getJakartaTodayString } from "@/lib/child/jakarta-today";
import {
  EMPTY_FAMILY_SHARED_GOAL,
  fetchFamilySharedGoal,
  type FamilySharedGoal,
} from "@/lib/parent/family-shared-goal";
import type { ChildProfile, Goal, Task, TaskRequest } from "@/types/database";

/** RPC kustom belum terdaftar di generated Database types. */
function callProfileRpc(supabase: AppSupabaseClient, fn: string, profileId: string) {
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
  engagement: ChildEngagementData;
  sharedFamilyGoal: FamilySharedGoal;
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
  goalSaveEnabled: boolean;
};

export type ChildMissionsBundle = {
  tasks: TaskWithStatus[];
  pendingRequests: TaskRequest[];
};

export async function fetchChildPoints(profileId: string): Promise<number> {
  const supabase = createClient();
  const { data: ledger } = await supabase
    .from("point_ledger")
    .select("amount")
    .eq("profile_id", profileId);

  return ledger?.reduce((sum, entry) => sum + entry.amount, 0) ?? 0;
}

export async function fetchChildHomeData(
  profileId: string,
  supabase?: AppSupabaseClient,
): Promise<ChildHomeData> {
  const client = supabase ?? createClient();
  const todayStr = getJakartaTodayString();

  const [profileResult, ledgerResult, goalResult, chainResult, checkInResult] =
    await Promise.all([
      client.from("child_profiles").select("*").eq("id", profileId).maybeSingle(),
      client.from("point_ledger").select("amount").eq("profile_id", profileId),
      client
        .from("goals")
        .select("*")
        .eq("profile_id", profileId)
        .eq("status", "active")
        .maybeSingle(),
      callProfileRpc(client, "compute_check_in_chain_length", profileId),
      client
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

  const child = profileResult.data ?? null;
  const emptyEngagement: ChildEngagementData = {
    personalStickyMessage: null,
    familyBroadcastMessage: null,
    stickyMessage: null,
    dailyTip: null,
    siblingHighlight: null,
    goalCountdowns: [],
    settings: { ...DEFAULT_CHILD_ENGAGEMENT_SETTINGS },
  };
  const engagement =
    child?.family_id != null
      ? await fetchChildEngagement(profileId, child.family_id)
      : emptyEngagement;

  const sticky = await getChildStickyMessagesAction(profileId);
  engagement.personalStickyMessage = sticky.personalStickyMessage;
  engagement.familyBroadcastMessage = sticky.familyBroadcastMessage;
  engagement.stickyMessage = sticky.stickyMessage;

  const sharedFamilyGoal =
    child?.family_id != null
      ? await fetchFamilySharedGoal(child.family_id, client)
      : EMPTY_FAMILY_SHARED_GOAL;

  return {
    child,
    activeGoal: goalResult.data ?? null,
    totalPoints,
    checkInChain,
    isCheckedInToday: !!checkInResult.data,
    engagement,
    sharedFamilyGoal,
  };
}

export async function fetchChildMissionsData(
  profileId: string,
  supabase?: AppSupabaseClient,
): Promise<ChildMissionsBundle> {
  const client = supabase ?? createClient();
  const todayStr = getJakartaTodayString();

  const [tasksResult, historyResult, featuredResult, pendingRequestsResult] =
    await Promise.all([
    client
      .from("tasks")
      .select("*")
      .eq("profile_id", profileId)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    client
      .from("task_history")
      .select("id, task_id, status")
      .eq("profile_id", profileId)
      .eq("period_date", todayStr),
    callProfileRpc(client, "compute_featured_task", profileId),
    client
      .from("task_requests")
      .select("*")
      .eq("profile_id", profileId)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  if (tasksResult.error) throw tasksResult.error;
  if (historyResult.error) throw historyResult.error;

  const todayHistory = historyResult.data ?? [];
  const featuredData = featuredResult.data as
    | { task_id: string; multiplier_text: string; multiplier_value: number }[]
    | null;
  const featuredTask =
    featuredData && featuredData.length > 0 ? featuredData[0] : null;

  const tasks = (tasksResult.data ?? []).map((task) => {
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

  return {
    tasks,
    pendingRequests: (pendingRequestsResult.data as TaskRequest[]) ?? [],
  };
}

export async function fetchChildTargetsData(
  profileId: string,
  supabase?: AppSupabaseClient,
): Promise<ChildTargetsData> {
  const client = supabase ?? createClient();

  const { data: child } = await client
    .from("child_profiles")
    .select("family_id")
    .eq("id", profileId)
    .maybeSingle();

  const [goalsResult, ledgerResult, settingsResult] = await Promise.all([
    client
      .from("goals")
      .select("*")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false }),
    client.from("point_ledger").select("amount").eq("profile_id", profileId),
    child?.family_id
      ? client
          .from("family_settings")
          .select("goal_save_enabled")
          .eq("family_id", child.family_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const totalPoints =
    ledgerResult.data?.reduce((sum, entry) => sum + entry.amount, 0) ?? 0;

  return {
    goals: goalsResult.data ?? [],
    totalPoints,
    goalSaveEnabled: settingsResult.data?.goal_save_enabled ?? true,
  };
}
