import type { AppSupabaseClient } from "@/lib/supabase/types";

export const SHARED_FAMILY_GOAL_MIN_TARGET = 10;
export const SHARED_FAMILY_GOAL_MAX_TARGET = 999_999;
export const SHARED_FAMILY_GOAL_MAX_TITLE_LENGTH = 80;

export type FamilySharedGoal = {
  title: string | null;
  targetPoints: number | null;
  celebrationDismissed: boolean;
  familyEarnEnergy: number;
};

export const EMPTY_FAMILY_SHARED_GOAL: FamilySharedGoal = {
  title: null,
  targetPoints: null,
  celebrationDismissed: false,
  familyEarnEnergy: 0,
};

export function isSharedFamilyGoalActive(goal: FamilySharedGoal): boolean {
  const title = goal.title?.trim();
  return (
    !!title &&
    goal.targetPoints != null &&
    goal.targetPoints >= SHARED_FAMILY_GOAL_MIN_TARGET &&
    goal.targetPoints <= SHARED_FAMILY_GOAL_MAX_TARGET
  );
}

export function getSharedFamilyGoalPercent(
  familyEarnEnergy: number,
  targetPoints: number,
): number {
  if (targetPoints <= 0) return 0;
  return Math.min(100, Math.round((familyEarnEnergy / targetPoints) * 100));
}

export function shouldCelebrateSharedFamilyGoal(goal: FamilySharedGoal): boolean {
  if (!isSharedFamilyGoalActive(goal) || goal.targetPoints == null) return false;
  return goal.familyEarnEnergy >= goal.targetPoints && !goal.celebrationDismissed;
}

export function computeFamilyEarnEnergy(
  ledger: { amount: number; type: string }[] | null | undefined,
): number {
  let total = 0;
  for (const entry of ledger ?? []) {
    if (entry.type === "earn") total += entry.amount;
  }
  return total;
}

type LedgerEarnRow = { amount: number; type: string };

/** Muat milestone keluarga; pass `ledger` bila sudah di-fetch (hemat query di beranda ortu). */
export async function fetchFamilySharedGoal(
  familyId: string,
  supabase: AppSupabaseClient,
  options?: { ledger?: LedgerEarnRow[] | null; childIds?: string[] },
): Promise<FamilySharedGoal> {
  let childIds = options?.childIds;

  if (!childIds) {
    const { data: children } = await supabase
      .from("child_profiles")
      .select("id")
      .eq("family_id", familyId)
      .is("archived_at", null);

    childIds = (children as { id: string }[] | null)?.map((c) => c.id) ?? [];
  }

  if (childIds.length === 0) {
    return EMPTY_FAMILY_SHARED_GOAL;
  }

  const [ledgerResult, settingsResult] = await Promise.all([
    options?.ledger != null
      ? Promise.resolve({ data: options.ledger, error: null })
      : supabase
          .from("point_ledger")
          .select("amount, type")
          .in("profile_id", childIds),
    supabase
      .from("family_settings")
      .select(
        "shared_family_goal_title, shared_family_goal_target_points, shared_family_goal_celebration_dismissed",
      )
      .eq("family_id", familyId)
      .maybeSingle(),
  ]);

  if (settingsResult.error) {
    console.error("fetchFamilySharedGoal settings:", settingsResult.error);
  }

  const settings = settingsResult.error
    ? null
    : (settingsResult.data as {
        shared_family_goal_title: string | null;
        shared_family_goal_target_points: number | null;
        shared_family_goal_celebration_dismissed: boolean;
      } | null);

  return {
    title: settings?.shared_family_goal_title ?? null,
    targetPoints: settings?.shared_family_goal_target_points ?? null,
    celebrationDismissed: settings?.shared_family_goal_celebration_dismissed ?? false,
    familyEarnEnergy: computeFamilyEarnEnergy(ledgerResult.data),
  };
}
