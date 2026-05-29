"use client";

import { ChildCard } from "@/components/parent/child-card";
import type { ParentDashboardData } from "@/lib/parent/fetch-parent-dashboard";
import { cn } from "@/lib/utils";

type ChildItem = ParentDashboardData["childrenWithData"][number];

type ChildrenCarouselProps = {
  items: ChildItem[];
};

export function ChildrenCarousel({ items }: ChildrenCarouselProps) {
  const showPeek = items.length > 1;
  const slideWidth = showPeek
    ? "w-[calc(100%-2.25rem)] sm:w-[360px]"
    : "w-full";

  return (
    <ul
      className={cn(
        "m-0 flex list-none snap-x snap-mandatory gap-3 overflow-x-auto p-0 scrollbar-none",
        "overscroll-x-contain",
        showPeek && "-mr-4 pr-4",
      )}
      aria-label="Daftar profil anak"
    >
      {items.map((item) => (
        <li
          key={item.child.id}
          className={cn("flex shrink-0 snap-start", slideWidth)}
        >
          <ChildCard
            className="flex-1"
            child={item.child}
            activeGoal={item.activeGoal}
            points={item.points}
          />
        </li>
      ))}
    </ul>
  );
}
