import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_CHILD_ENGAGEMENT_SETTINGS,
  type ChildEngagementData,
  type ChildEngagementSettings,
  type DailyTip,
  type GoalCountdownRow,
  type SiblingHighlight,
} from "@/lib/child/engagement-types";

type SupabaseClient = ReturnType<typeof createClient>;

function callProfileRpc(supabase: SupabaseClient, fn: string, profileId: string) {
  const client = supabase as unknown as {
    rpc: (
      name: string,
      args: { p_profile_id: string },
    ) => Promise<{ data: unknown; error: unknown }>;
  };
  return client.rpc(fn, { p_profile_id: profileId });
}

function resolveStickyMessage(
  parentSticky: string | null | undefined,
  familyBroadcast: string | null | undefined,
): string | null {
  const personal = parentSticky?.trim();
  if (personal) return personal;
  const family = familyBroadcast?.trim();
  return family || null;
}

export async function fetchChildEngagement(
  profileId: string,
  familyId: string,
  parentSticky: string | null | undefined,
): Promise<ChildEngagementData> {
  if (!familyId) {
    return {
      stickyMessage: null,
      dailyTip: null,
      siblingHighlight: null,
      goalCountdowns: [],
      settings: { ...DEFAULT_CHILD_ENGAGEMENT_SETTINGS },
    };
  }

  const supabase = createClient();

  const [familyResult, settingsResult, tipResult, siblingResult, countdownResult] =
    await Promise.all([
      supabase
        .from("families")
        .select("family_broadcast_message")
        .eq("id", familyId)
        .maybeSingle(),
      supabase
        .from("family_settings")
        .select(
          "micro_anim_enabled, daily_tip_enabled, show_sibling_highlight, family_garden_enabled",
        )
        .eq("family_id", familyId)
        .maybeSingle(),
      callProfileRpc(supabase, "pick_daily_tip", profileId),
      callProfileRpc(supabase, "pick_sibling_highlight", profileId),
      callProfileRpc(supabase, "compute_goal_countdown", profileId),
    ]);

  const familyRow = familyResult.data as { family_broadcast_message?: string | null } | null;
  const settingsRow = settingsResult.data as {
    micro_anim_enabled?: boolean;
    daily_tip_enabled?: boolean;
    show_sibling_highlight?: boolean;
    family_garden_enabled?: boolean;
  } | null;

  const settings: ChildEngagementSettings = {
    microAnimEnabled:
      settingsRow?.micro_anim_enabled ?? DEFAULT_CHILD_ENGAGEMENT_SETTINGS.microAnimEnabled,
    dailyTipEnabled:
      settingsRow?.daily_tip_enabled ?? DEFAULT_CHILD_ENGAGEMENT_SETTINGS.dailyTipEnabled,
    showSiblingHighlight:
      settingsRow?.show_sibling_highlight ??
      DEFAULT_CHILD_ENGAGEMENT_SETTINGS.showSiblingHighlight,
    familyGardenEnabled:
      settingsRow?.family_garden_enabled ??
      DEFAULT_CHILD_ENGAGEMENT_SETTINGS.familyGardenEnabled,
  };

  let dailyTip: DailyTip | null = null;
  if (settings.dailyTipEnabled && !tipResult.error) {
    const rows = tipResult.data as { emoji: string; title: string; body: string }[] | null;
    if (rows?.[0]) {
      dailyTip = { emoji: rows[0].emoji, title: rows[0].title, body: rows[0].body };
    }
  }

  let siblingHighlight: SiblingHighlight | null = null;
  if (settings.showSiblingHighlight && !siblingResult.error) {
    const rows = siblingResult.data as
      | { sibling_name: string; approved_recent: number }[]
      | null;
    if (rows?.[0]) {
      siblingHighlight = {
        siblingName: rows[0].sibling_name,
        approvedRecent: rows[0].approved_recent,
      };
    }
  }

  const goalCountdowns: GoalCountdownRow[] = [];
  if (!countdownResult.error && Array.isArray(countdownResult.data)) {
    for (const row of countdownResult.data as {
      goal_id: string;
      title: string;
      current_hp: number;
      target_hp: number;
      days_left: number;
      near_deadline: boolean;
    }[]) {
      goalCountdowns.push({
        goalId: row.goal_id,
        title: row.title,
        currentHp: row.current_hp,
        targetHp: row.target_hp,
        daysLeft: row.days_left,
        nearDeadline: row.near_deadline,
      });
    }
  }

  return {
    stickyMessage: resolveStickyMessage(
      parentSticky,
      familyRow?.family_broadcast_message,
    ),
    dailyTip,
    siblingHighlight,
    goalCountdowns,
    settings,
  };
}
