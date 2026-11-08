export const GOAL_REQUEST_HP_MIN = 1;
export const GOAL_REQUEST_HP_MAX = 100_000;
export const GOAL_REQUEST_TITLE_MAX = 120;
export const GOAL_REQUEST_NOTE_MAX = 280;

export function parseGoalRequestHp(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  const hp = Math.floor(numeric);
  if (hp < GOAL_REQUEST_HP_MIN || hp > GOAL_REQUEST_HP_MAX) return null;
  return hp;
}
