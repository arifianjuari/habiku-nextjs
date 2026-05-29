/**
 * Nama & kontrak RPC — dari `docs/database-architecture.md` §6
 * dan PRD React §10 (beberapa nama parameter disesuaikan versi migrasi).
 */

export const RPC = {
  approveTaskHistory: "approve_task_history",
  rejectTaskHistory: "reject_task_history",
  verifyChildProfilePin: "verify_child_profile_pin",
  giveIncidentalReward: "give_incidental_reward",
  markMissedTasksTick: "mark_missed_tasks_tick",
  profileFullDailyMissionStreak: "profile_full_daily_mission_streak",
  transferGoalHp: "transfer_goal_hp",
  awardDailyCheckinBonus: "award_daily_checkin_bonus",
  computeGoalCountdown: "compute_goal_countdown",
  computeFeaturedTask: "compute_featured_task",
  awardEligibleBadges: "award_eligible_badges",
  pickDailyTip: "pick_daily_tip",
  pickSiblingHighlight: "pick_sibling_highlight",
  submitChildReflection: "submit_child_reflection",
  thankBroadcastMessage: "thank_broadcast_message",
  computeCheckInChain: "compute_check_in_chain",
  setChildParentStickyMessage: "set_child_parent_sticky_message",
  setFamilyBroadcastMessage: "set_family_broadcast_message",
  approveTaskRequest: "approve_task_request",
  approveGoalRequest: "approve_goal_request",
  createChildProfile: "create_child_profile",
  updateChildProfile: "update_child_profile",
  createFamilyInvite: "create_family_invite",
  acceptFamilyInvite: "accept_family_invite",
} as const;

export type RpcName = (typeof RPC)[keyof typeof RPC];

/** Argumen umum — perlu diselaraskan setelah `supabase gen types` */
export type ApproveTaskHistoryArgs = {
  p_task_history_id: string;
  p_goal_id?: string | null;
};

export type RejectTaskHistoryArgs = {
  p_task_history_id: string;
  p_reason: string;
};

export type VerifyChildPinArgs = {
  p_profile_id: string;
  p_pin: string;
};
