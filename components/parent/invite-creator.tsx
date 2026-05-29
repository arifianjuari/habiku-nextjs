"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createFamilyInviteAction } from "@/app/invite/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Share2, Copy, Check, Sparkles, UserPlus } from "lucide-react";

interface InviteCreatorProps {
  isPrimary: boolean;
}

export function InviteCreator({ isPrimary }: InviteCreatorProps) {
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleCreateInvite = () => {
    if (!isPrimary) {
      toast.error("Hanya Ortu Utama (Primary Parent) yang dapat membuat undangan.");
      return;
    }

    startTransition(async () => {
      const res = await createFamilyInviteAction();
      if (res?.error) {
        toast.error(res.error);
      } else if (res?.success && res.token) {
        setToken(res.token);
        toast.success("Link undangan berhasil dibuat! ✉️");
      }
    });
  };

  const handleCopy = () => {
    if (!token) return;
    const inviteUrl = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    toast.success("Link undangan berhasil disalin ke papan klip!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border border-slate-150 shadow-sm rounded-2xl overflow-hidden bg-white">
      <CardContent className="p-5 space-y-4">
        <div className="flex gap-3 items-start">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700 shadow-inner">
            <UserPlus className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900 leading-none">Undang Orang Tua Kedua</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Beri akses kepada pasangan Anda untuk bersama-sama mengelola misi, poin, dan progres target anak.
            </p>
          </div>
        </div>

        {!isPrimary ? (
          <div className="rounded-xl bg-slate-50 border border-slate-200/50 p-3 text-[10px] text-slate-500">
            Hanya Ortu Utama (Primary Parent) yang memiliki wewenang untuk membuat link undangan keluarga.
          </div>
        ) : !token ? (
          <Button
            onClick={handleCreateInvite}
            disabled={isPending}
            className="w-full bg-violet-700 hover:bg-violet-800 text-white font-bold h-10 rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-2"
          >
            <Share2 className="h-4 w-4" />
            {isPending ? "Membuat Link..." : "Buat Link Undangan"}
          </Button>
        ) : (
          <div className="space-y-3 pt-1">
            <div className="rounded-xl border border-violet-100 bg-violet-50/20 p-3 space-y-2">
              <span className="text-[10px] font-bold text-violet-950 block leading-none">
                Bagikan link ini kepada pasangan Anda:
              </span>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/invite/${token}`}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 h-8 text-[10px] select-all font-mono text-slate-600 focus:outline-none"
                />
                <button
                  onClick={handleCopy}
                  className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 bg-white text-slate-600 transition-colors cursor-pointer"
                  title="Salin Link"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
              <span className="text-[9px] text-muted-foreground block">
                *Link undangan ini berlaku selama 14 hari dan hanya dapat digunakan sekali.
              </span>
            </div>

            <Button
              variant="outline"
              onClick={() => setToken(null)}
              className="w-full h-8 text-xs font-semibold rounded-lg border-slate-200 text-slate-500 hover:bg-slate-50"
            >
              Reset Undangan
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
