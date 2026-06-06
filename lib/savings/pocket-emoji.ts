/** Emoji preset untuk ikon kantong tabungan (1 karakter, muat constraint DB). */
export const SAVINGS_POCKET_EMOJI_OPTIONS = [
  "🐷",
  "💰",
  "🪙",
  "🏦",
  "💎",
  "🎯",
  "🚲",
  "🎮",
  "📚",
  "✈️",
  "🏠",
  "🎁",
  "⭐",
  "🚀",
  "🏆",
  "🐢",
  "🌈",
  "⚽",
  "🧸",
  "🎸",
] as const;

export const DEFAULT_SAVINGS_POCKET_EMOJI = SAVINGS_POCKET_EMOJI_OPTIONS[0];

export function isAllowedSavingsPocketEmoji(value: string): boolean {
  return (SAVINGS_POCKET_EMOJI_OPTIONS as readonly string[]).includes(value);
}
