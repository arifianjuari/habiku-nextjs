"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Radio } from "lucide-react";
import { setFamilyBroadcastMessageAction } from "@/app/parent/engagement/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type FamilyBroadcastEditorProps = {
  initialMessage: string | null;
};

export function FamilyBroadcastEditor({ initialMessage }: FamilyBroadcastEditorProps) {
  const [message, setMessage] = useState(initialMessage ?? "");
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      const res = await setFamilyBroadcastMessageAction(message);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Pesan untuk semua anak tersimpan!");
    });
  };

  return (
    <Card
      size="sm"
      className="gap-0 overflow-hidden rounded-2xl border-violet-100 bg-white py-0 shadow-sm data-[size=sm]:py-0"
    >
      <CardContent className="space-y-1.5 p-2">
        <div className="flex items-center gap-1">
          <Radio className="h-3 w-3 shrink-0 text-violet-600" aria-hidden />
          <Label
            htmlFor="family-broadcast"
            className="text-[11px] font-bold leading-tight text-slate-900"
          >
            Pesan untuk semua anak
          </Label>
        </div>
        <textarea
          id="family-broadcast"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={280}
          rows={2}
          placeholder="Contoh: Semangat misi hari ini, kita bangga padamu!"
          className="min-h-0 w-full resize-none rounded-md border border-slate-200 bg-slate-50/50 px-1.5 py-0.5 text-[11px] leading-snug focus:outline-none focus:ring-2 focus:ring-violet-400/40"
        />
        <div className="flex items-center justify-between gap-1">
          <span className="text-[9px] text-muted-foreground">{message.length}/280</span>
          <Button
            type="button"
            size="xs"
            data-compact
            disabled={isPending}
            onClick={handleSave}
            className="cursor-pointer rounded px-1.5 text-[9px] font-bold"
          >
            {isPending ? "Menyimpan…" : "Simpan pesan"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
