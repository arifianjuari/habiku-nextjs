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

export type SavingsPocketEmoji = (typeof SAVINGS_POCKET_EMOJI_OPTIONS)[number];

export const DEFAULT_SAVINGS_POCKET_EMOJI: SavingsPocketEmoji = SAVINGS_POCKET_EMOJI_OPTIONS[0];

export function resolveSavingsPocketEmoji(value: string | null | undefined): SavingsPocketEmoji {
  if (value && isAllowedSavingsPocketEmoji(value)) {
    return value as SavingsPocketEmoji;
  }
  return DEFAULT_SAVINGS_POCKET_EMOJI;
}

export function isAllowedSavingsPocketEmoji(value: string): boolean {
  return (SAVINGS_POCKET_EMOJI_OPTIONS as readonly string[]).includes(value);
}
