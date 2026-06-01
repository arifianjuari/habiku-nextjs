import type { Account, Family } from "@/types/database";
import {
  getFamilyAggregates,
  getFamilyRecentActivities,
  type ParentDashboardActivity,
  type ParentDashboardChild,
  type ParentHomeAggregates,
} from "@/lib/parent/parent-home-data";

export type {
  ParentDashboardChild,
  ParentDashboardActivity,
  ParentHomeAggregates,
};

export type ParentDashboardData = ParentHomeAggregates & {
  account: Account;
  family: Family;
  recentActivities: ParentDashboardActivity[];
};

/** Muat seluruh dashboard sekaligus (mis. refresh penuh). */
export async function fetchParentDashboard(
  familyId: string,
  account: Account,
  family: Family,
): Promise<ParentDashboardData> {
  const [aggregates, recentActivities] = await Promise.all([
    getFamilyAggregates(familyId),
    getFamilyRecentActivities(familyId),
  ]);

  return {
    account,
    family,
    recentActivities,
    ...aggregates,
  };
}
