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
    <Card className="rounded-2xl border-violet-100 bg-white shadow-sm">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-violet-600" aria-hidden />
          <Label htmlFor="family-broadcast" className="text-sm font-bold text-slate-900">
            Pesan untuk semua anak
          </Label>
        </div>
        <textarea
          id="family-broadcast"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={280}
          rows={3}
          placeholder="Contoh: Semangat misi hari ini, kita bangga padamu!"
          className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-400/40"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-muted-foreground">{message.length}/280</span>
          <Button
            type="button"
            size="sm"
            disabled={isPending}
            onClick={handleSave}
            className="rounded-xl font-bold cursor-pointer"
          >
            {isPending ? "Menyimpan…" : "Simpan pesan"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
