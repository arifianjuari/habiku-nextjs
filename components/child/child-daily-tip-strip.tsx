"use client";

import { motion } from "framer-motion";
import { Lightbulb } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { DailyTip } from "@/lib/child/engagement-types";

type ChildDailyTipStripProps = {
  tip: DailyTip;
  microAnimEnabled: boolean;
};

export function ChildDailyTipStrip({ tip, microAnimEnabled }: ChildDailyTipStripProps) {
  const Wrapper = microAnimEnabled ? motion.div : "div";
  const wrapperProps = microAnimEnabled
    ? { initial: { opacity: 0, x: -6 }, animate: { opacity: 1, x: 0 }, transition: { delay: 0.05 } }
    : {};

  return (
    <Wrapper {...wrapperProps}>
      <Card className="border border-sky-200/70 bg-sky-50/40 rounded-3xl shadow-sm">
        <CardContent className="p-4 flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-2xl">
            {tip.emoji || "💡"}
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-1.5">
              <Lightbulb className="h-3.5 w-3.5 text-sky-600" aria-hidden />
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700">
                Tahukah Kamu?
              </span>
            </div>
            <h4 className="text-xs font-black text-slate-900 leading-tight">{tip.title}</h4>
            <p className="text-[11px] text-slate-600 leading-relaxed text-pretty">{tip.body}</p>
          </div>
        </CardContent>
      </Card>
    </Wrapper>
  );
}
