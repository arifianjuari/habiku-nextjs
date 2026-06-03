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
    <div className="rounded-xl border border-violet-100 bg-violet-50/30 p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-[10px] font-bold text-violet-800 uppercase tracking-wide">
        <StickyNote className="h-3.5 w-3.5" aria-hidden />
        Sticky khusus {childName}
      </div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={200}
        rows={2}
        placeholder="Pesan pribadi (menggantikan pesan keluarga jika diisi)"
        className="w-full rounded-lg border border-violet-200/80 bg-white px-2.5 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-violet-400/30"
        aria-label={`Sticky note untuk ${childName}`}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={handleSave}
        className="h-8 rounded-lg text-[10px] font-bold cursor-pointer"
      >
        {isPending ? "…" : "Simpan sticky"}
      </Button>
    </div>
  );
}
