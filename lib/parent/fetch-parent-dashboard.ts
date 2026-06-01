import { createClient } from "@/lib/supabase/server";
import type { Account, ChildProfile, Family, Goal } from "@/types/database";

export type ParentDashboardChild = {
  child: ChildProfile;
  activeGoal: Goal | null;
  points: number;
};

export type ParentDashboardActivity = {
  id: string;
  status: string;
  completed_at: string;
  notes: string | null;
  profile_id: string;
  task: { title: string; reward_points: number; category: string } | null;
  child: { name: string } | null;
};

export type ParentDashboardData = {
  account: Account;
  family: Family;
  childrenWithData: ParentDashboardChild[];
  pendingCount: number;
  recentActivities: ParentDashboardActivity[];
  familyEnergy: number;
  activeGoalsCount: number;
};

function sumPointsByProfile(
  ledger: { profile_id: string; amount: number }[] | null,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const entry of ledger ?? []) {
    map.set(entry.profile_id, (map.get(entry.profile_id) ?? 0) + entry.amount);
  }
  return map;
}

export async function fetchParentDashboard(
  familyId: string,
  account: Account,
  family: Family,
): Promise<ParentDashboardData> {
  const supabase = await createClient();

  const { data: childrenRaw } = await supabase
    .from("child_profiles")
    .select("*")
    .eq("family_id", familyId)
    .order("created_at", { ascending: true });

  const children = childrenRaw ?? [];
  const childIds = children.map((c) => c.id);

  if (childIds.length === 0) {
    return {
      account,
      family,
      childrenWithData: [],
      pendingCount: 0,
      recentActivities: [],
      familyEnergy: 0,
      activeGoalsCount: 0,
    };
  }

  const [activeGoalsResult, ledgerResult, pendingResult, activitiesResult] =
    await Promise.all([
      supabase
        .from("goals")
        .select("*")
        .in("profile_id", childIds)
        .eq("status", "active")
        .order("created_at", { ascending: true }),
      supabase
        .from("point_ledger")
        .select("profile_id, amount")
        .in("profile_id", childIds),
      supabase
        .from("task_history")
        .select("*", { count: "exact", head: true })
        .in("profile_id", childIds)
        .eq("status", "pending"),
      supabase
        .from("task_history")
        .select(
          `
        id,
        status,
        completed_at,
        notes,
        profile_id,
        tasks (title, reward_points, category),
        child_profiles (name)
      `,
        )
        .in("profile_id", childIds)
        .order("completed_at", { ascending: false })
        .limit(6),
    ]);

  const activeGoalsByProfile = new Map<string, Goal>();
  let activeGoalsCount = 0;

  for (const goal of activeGoalsResult.data ?? []) {
    activeGoalsCount += 1;
    if (!activeGoalsByProfile.has(goal.profile_id)) {
      activeGoalsByProfile.set(goal.profile_id, goal);
    }
  }

  const pointsByProfile = sumPointsByProfile(ledgerResult.data);

  const childrenWithData: ParentDashboardChild[] = children.map((child) => ({
    child,
    activeGoal: activeGoalsByProfile.get(child.id) ?? null,
    points: pointsByProfile.get(child.id) ?? 0,
  }));

  type ActivityRow = {
    id: string;
    status: string;
    completed_at: string;
    notes: string | null;
    profile_id: string;
    tasks:
      | { title: string; reward_points: number; category: string }
      | { title: string; reward_points: number; category: string }[]
      | null;
    child_profiles: { name: string } | { name: string }[] | null;
  };

  const recentActivities: ParentDashboardActivity[] = (
    (activitiesResult.data || []) as ActivityRow[]
  ).map((row) => {
    const taskRow = row.tasks;
    const childRow = row.child_profiles;
    const task = Array.isArray(taskRow) ? (taskRow[0] ?? null) : taskRow;
    const child = Array.isArray(childRow) ? (childRow[0] ?? null) : childRow;

    return {
      id: row.id,
      status: row.status,
      completed_at: row.completed_at,
      notes: row.notes,
      profile_id: row.profile_id,
      task,
      child,
    };
  });

  const familyEnergy = childrenWithData.reduce((sum, item) => sum + item.points, 0);

  return {
    account,
    family,
    childrenWithData,
    pendingCount: pendingResult.count ?? 0,
    recentActivities,
    familyEnergy,
    activeGoalsCount,
  };
}
