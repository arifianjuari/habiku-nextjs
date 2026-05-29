/** Enum domain — selaras dengan `docs/database-architecture.md` §3 */

export const ACCOUNT_ROLES = ["primary_parent", "secondary_parent"] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

export const GOAL_STATUSES = ["active", "completed", "archived"] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export const FREQUENCY_TYPES = ["daily", "weekly", "custom"] as const;
export type FrequencyType = (typeof FREQUENCY_TYPES)[number];

export const TASK_CATEGORIES = [
  "ibadah",
  "belajar",
  "kebersihan",
  "olahraga",
  "lainnya",
] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number];

export const LEDGER_TYPES = [
  "earn",
  "spend",
  "adjustment",
  "bonus_checkin",
  "mystery_bonus",
] as const;
export type LedgerType = (typeof LEDGER_TYPES)[number];

export const TASK_HISTORY_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "missed",
] as const;
export type TaskHistoryStatus = (typeof TASK_HISTORY_STATUSES)[number];

export const NOTIFICATION_RECIPIENT_TYPES = ["account", "profile"] as const;
export type NotificationRecipientType =
  (typeof NOTIFICATION_RECIPIENT_TYPES)[number];

export const REQUEST_STATUSES = ["pending", "approved", "rejected"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const REFLECTION_MOODS = [
  "sangat_senang",
  "senang",
  "biasa",
  "kurang_senang",
] as const;
export type ReflectionMood = (typeof REFLECTION_MOODS)[number];

export const GOAL_VISUAL_STATES = [
  "fresh",
  "slightly_wilted",
  "wilted",
  "dormant",
] as const;
export type GoalVisualState = (typeof GOAL_VISUAL_STATES)[number];

export const STORAGE_BUCKETS = {
  childAvatars: "child-avatars",
  goalImages: "goal-images",
  taskEvidence: "task-evidence",
} as const;
