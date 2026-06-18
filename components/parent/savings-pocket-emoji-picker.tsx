"use client";

import {
  DEFAULT_SAVINGS_POCKET_EMOJI,
  SAVINGS_POCKET_EMOJI_OPTIONS,
  type SavingsPocketEmoji,
} from "@/lib/savings/pocket-emoji";
import { cn } from "@/lib/utils";

type SavingsPocketEmojiPickerProps = {
  id: string;
  name: string;
  value: SavingsPocketEmoji;
  onChange: (emoji: SavingsPocketEmoji) => void;
};

export function SavingsPocketEmojiPicker({
  id,
  name,
  value,
  onChange,
}: SavingsPocketEmojiPickerProps) {
  const selected = value || DEFAULT_SAVINGS_POCKET_EMOJI;

  return (
    <div className="space-y-2">
      <div
        className="flex h-10 items-center gap-2 rounded-lg border border-input bg-muted/20 px-2.5"
        aria-live="polite"
      >
        <span className="text-xl leading-none" aria-hidden>
          {selected}
        </span>
        <span className="text-[10px] font-medium text-muted-foreground">Emoji terpilih</span>
      </div>
      <input type="hidden" id={id} name={name} value={selected} />
      <div
        className="grid grid-cols-5 gap-1.5 rounded-xl border border-border/60 bg-muted/15 p-1.5 sm:grid-cols-10"
        role="listbox"
        aria-label="Pilih emoji kantong"
      >
        {SAVINGS_POCKET_EMOJI_OPTIONS.map((emoji) => {
          const isSelected = selected === emoji;
          return (
            <button
              key={emoji}
              type="button"
              role="option"
              aria-selected={isSelected}
              aria-label={`Emoji ${emoji}`}
              onClick={() => onChange(emoji)}
              className={cn(
                "flex h-8 w-full items-center justify-center rounded-lg text-lg transition-colors",
                isSelected
                  ? "bg-white ring-1 ring-violet-400 shadow-sm"
                  : "hover:bg-white/80",
              )}
            >
              {emoji}
            </button>
          );
        })}
      </div>
    </div>
  );
}
