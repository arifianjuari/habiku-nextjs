"use client";

import { motion } from "framer-motion";
import { Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { SiblingHighlight } from "@/lib/child/engagement-types";

type ChildSiblingHighlightProps = {
  highlight: SiblingHighlight;
  microAnimEnabled: boolean;
};

export function ChildSiblingHighlight({
  highlight,
  microAnimEnabled,
}: ChildSiblingHighlightProps) {
  const Wrapper = microAnimEnabled ? motion.div : "div";
  const wrapperProps = microAnimEnabled
    ? { initial: { opacity: 0, scale: 0.98 }, animate: { opacity: 1, scale: 1 }, transition: { delay: 0.08 } }
    : {};

  return (
    <Wrapper {...wrapperProps}>
      <Card
        size="sm"
        className="gap-0 rounded-3xl border border-amber-200/70 bg-amber-50/50 py-0 shadow-sm"
      >
        <CardContent className="flex items-center gap-2.5 p-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <Users className="h-5 w-5" aria-hidden />
          </div>
          <p className="text-[11px] font-semibold text-amber-950 leading-relaxed text-pretty">
            <span className="font-black">{highlight.siblingName}</span> baru saja menyelesaikan{" "}
            {highlight.approvedRecent} misi — kamu juga bisa! 🌟
          </p>
        </CardContent>
      </Card>
    </Wrapper>
  );
}
