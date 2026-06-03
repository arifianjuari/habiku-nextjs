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
      <Card className="border border-amber-200/70 bg-amber-50/50 rounded-3xl shadow-sm">
        <CardContent className="p-4 flex gap-3 items-center">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
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
