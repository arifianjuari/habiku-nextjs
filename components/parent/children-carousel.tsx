"use client";

import { ChildCard } from "@/components/parent/child-card";
import type { ParentDashboardChild } from "@/lib/parent/parent-home-data";
import { cn } from "@/lib/utils";

type ChildrenCarouselProps = {
  items: ParentDashboardChild[];
};

export function ChildrenCarousel({ items }: ChildrenCarouselProps) {
  const showPeek = items.length > 1;
  const slideWidth = showPeek ? "w-[80%] sm:w-[272px]" : "w-full";

  return (
    <div className={cn(showPeek && "-mr-4 pr-4")}>
      <ul
        className={cn(
          "m-0 flex list-none snap-x snap-mandatory gap-2 overflow-x-auto p-0 scrollbar-none",
          "overscroll-x-contain",
        )}
        aria-label="Daftar profil anak"
      >
        {items.map((item) => (
          <li
            key={item.child.id}
            className={cn("flex shrink-0 snap-start py-1", slideWidth)}
          >
            <ChildCard
              compact
              className="flex-1"
              child={item.child}
              activeGoal={item.activeGoal}
              points={item.points}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
