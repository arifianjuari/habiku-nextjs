export type DailyTip = {
  emoji: string;
  title: string;
  body: string;
};

export type SiblingHighlight = {
  siblingName: string;
  approvedRecent: number;
};

export type GoalCountdownRow = {
  goalId: string;
  title: string;
  currentHp: number;
  targetHp: number;
  daysLeft: number;
  nearDeadline: boolean;
};

export type ChildEngagementSettings = {
  microAnimEnabled: boolean;
  dailyTipEnabled: boolean;
  showSiblingHighlight: boolean;
  familyGardenEnabled: boolean;
};

export type ChildEngagementData = {
  stickyMessage: string | null;
  dailyTip: DailyTip | null;
  siblingHighlight: SiblingHighlight | null;
  goalCountdowns: GoalCountdownRow[];
  settings: ChildEngagementSettings;
};

export const DEFAULT_CHILD_ENGAGEMENT_SETTINGS: ChildEngagementSettings = {
  microAnimEnabled: true,
  dailyTipEnabled: true,
  showSiblingHighlight: false,
  familyGardenEnabled: true,
};
