"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { StickyNote } from "lucide-react";
import { setChildStickyMessageAction } from "@/app/parent/engagement/actions";
import { Button } from "@/components/ui/button";

type ChildStickyEditorProps = {
  profileId: string;
  childName: string;
  initialMessage: string | null;
};

export function ChildStickyEditor({
  profileId,
  childName,
  initialMessage,
}: ChildStickyEditorProps) {
  const [message, setMessage] = useState(initialMessage ?? "");
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      const res = await setChildStickyMessageAction(profileId, message);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Sticky untuk ${childName} tersimpan!`);
    });
  };

  return (
    <div className="space-y-1 rounded-md border border-violet-100 bg-violet-50/30 p-1.5">
      <div className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-wide text-violet-800">
        <StickyNote className="h-2.5 w-2.5 shrink-0" aria-hidden />
        <span className="truncate">Sticky khusus {childName}</span>
      </div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={200}
        rows={2}
        placeholder="Pesan pribadi (menggantikan pesan keluarga jika diisi)"
        className="min-h-0 w-full resize-none rounded border border-violet-200/80 bg-white px-1.5 py-0.5 text-[11px] leading-snug focus:outline-none focus:ring-2 focus:ring-violet-400/30"
        aria-label={`Sticky note untuk ${childName}`}
      />
      <div className="flex items-center justify-between gap-1">
        <span className="text-[9px] text-muted-foreground">{message.length}/200</span>
        <Button
          type="button"
          size="xs"
          data-compact
          variant="outline"
          disabled={isPending}
          onClick={handleSave}
          className="cursor-pointer rounded px-1.5 text-[9px] font-bold"
        >
          {isPending ? "…" : "Simpan sticky"}
        </Button>
      </div>
    </div>
  );
}
