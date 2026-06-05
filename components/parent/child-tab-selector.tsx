"use client";

import type { CSSProperties } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChildAvatar } from "@/components/shared/child-avatar";
import { cn } from "@/lib/utils";
import type { ChildProfile } from "@/types/database";

interface ChildTabSelectorProps {
  profiles: ChildProfile[];
  activeChildId: string;
  onActiveChildIdChange: (id: string) => void;
  className?: string;
}

export function ChildTabSelector({
  profiles,
  activeChildId,
  onActiveChildIdChange,
  className,
}: ChildTabSelectorProps) {
  if (profiles.length <= 1) return null;

  return (
    <Tabs
      value={activeChildId}
      onValueChange={onActiveChildIdChange}
      className={cn("w-full", className)}
    >
      <div className="overflow-x-auto pb-0.5 scrollbar-none">
        <TabsList className="inline-flex h-auto min-w-full w-max gap-1 rounded-xl border border-slate-200/80 bg-slate-100/80 p-1 shadow-inner">
          {profiles.map((child) => {
            const accentColor = child.home_card_accent || "#8B5CF6";
            const isActive = child.id === activeChildId;

            return (
              <TabsTrigger
                key={child.id}
                value={child.id}
                className={cn(
                  "relative h-auto shrink-0 gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition-all",
                  "text-slate-500 hover:text-slate-700",
                  "data-active:bg-white data-active:font-bold data-active:text-slate-900 data-active:shadow-sm",
                  "data-active:after:opacity-100 data-active:after:inset-x-2 data-active:after:bottom-1 data-active:after:h-0.5 data-active:after:rounded-full data-active:after:bg-[var(--tab-accent)]",
                )}
                style={
                  isActive
                    ? ({ "--tab-accent": accentColor } as CSSProperties)
                    : undefined
                }
              >
                <ChildAvatar
                  name={child.name}
                  avatarUrl={child.avatar_url}
                  avatarPreference={child.avatar_preference}
                  avatarEmoji={child.avatar_emoji}
                  accentColor={accentColor}
                  className="size-6 shrink-0 rounded-lg shadow-sm"
                  fallbackSizeClass="text-[10px]"
                />
                <span className="whitespace-nowrap">{child.name}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>
    </Tabs>
  );
}
