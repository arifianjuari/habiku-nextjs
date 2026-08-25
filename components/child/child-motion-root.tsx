"use client";

import type { ReactNode } from "react";
import { LazyMotion, domAnimation } from "@/lib/motion";

type MotionRootProps = {
  children: ReactNode;
};

/** Bungkus view anak agar framer-motion memuat domAnimation ringan, bukan engine penuh. */
export function ChildMotionRoot({ children }: MotionRootProps) {
  return <LazyMotion features={domAnimation}>{children}</LazyMotion>;
}
