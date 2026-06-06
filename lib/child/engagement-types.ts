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
  /** Sticky pribadi dari ortu — kartu ungu + override hero. */
  personalStickyMessage: string | null;
  /** Pesan broadcast keluarga — tampil di hero jika tidak ada sticky pribadi. */
  familyBroadcastMessage: string | null;
  /** Pesan efektif (pribadi > keluarga) untuk aksi terima kasih. */
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
