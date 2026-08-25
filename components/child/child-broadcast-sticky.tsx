"use client";

import { useTransition } from "react";
import { m } from "@/lib/motion";
import { Heart, MessageCircleHeart } from "lucide-react";
import { toast } from "sonner";
import { thankBroadcastAction } from "@/app/child/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type ChildBroadcastStickyProps = {
  profileId: string;
  message: string;
  microAnimEnabled: boolean;
};

export function ChildBroadcastSticky({
  profileId,
  message,
  microAnimEnabled,
}: ChildBroadcastStickyProps) {
  const [isPending, startTransition] = useTransition();

  const handleThanks = () => {
    startTransition(async () => {
      const res = await thankBroadcastAction(profileId);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Terima kasih sudah dikirim ke Papa/Mama! 💚");
    });
  };

  return (
    <m.div
      initial={microAnimEnabled ? { opacity: 0, y: 8 } : false}
      animate={microAnimEnabled ? { opacity: 1, y: 0 } : undefined}
    >
      <Card
        size="sm"
        className="gap-0 overflow-hidden rounded-3xl border border-violet-200/80 bg-gradient-to-br from-violet-50/90 to-fuchsia-50/50 py-0 shadow-sm"
      >
        <CardContent className="space-y-2.5 p-3">
          <div className="flex items-start gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
              <MessageCircleHeart className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              <h3 className="text-xs font-bold text-violet-950 leading-none">
                Pesan dari Papa/Mama
              </h3>
              <p className="text-sm font-medium text-violet-900/90 leading-relaxed text-pretty">
                «{message}»
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={handleThanks}
            className="h-9 w-full cursor-pointer rounded-xl border-violet-200 bg-white/80 font-bold text-violet-800 hover:bg-violet-50"
          >
            <Heart className="h-4 w-4 mr-1.5 fill-rose-400 text-rose-500" aria-hidden />
            {isPending ? "Mengirim…" : "Kirim Terima Kasih"}
          </Button>
        </CardContent>
      </Card>
    </m.div>
  );
}
