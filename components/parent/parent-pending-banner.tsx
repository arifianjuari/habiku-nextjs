"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type ParentPendingBannerProps = {
  pendingCount: number;
};

export function ParentPendingBanner({ pendingCount }: ParentPendingBannerProps) {
  if (pendingCount <= 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
    >
      <Link href="/parent/queue" className="block group">
        <Card className="overflow-hidden rounded-2xl border-amber-200/80 bg-gradient-to-r from-amber-50 to-orange-50/80 shadow-sm transition-shadow group-hover:shadow-md">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700"
                aria-hidden
              >
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0 space-y-0.5">
                <h3 className="text-sm font-bold text-amber-950">
                  {pendingCount} misi menunggu persetujuan
                </h3>
                <p className="text-xs text-amber-900/80 text-pretty">
                  Anak sudah mengirim bukti — tinjau dan setujui agar energi masuk ke
                  ledger.
                </p>
              </div>
            </div>
            <ChevronRight
              className="h-5 w-5 shrink-0 text-amber-700 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}
