"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play, Lock } from "lucide-react";
import { toast } from "sonner";
import { useChildModeStore } from "@/lib/stores/child-mode-store";
import { createClient } from "@/lib/supabase/client";
import { verifyChildProfilePin } from "@/lib/supabase/rpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type ChildModeEnterDialogProps = {
  profileId: string;
  childName: string;
  className?: string;
};

export function ChildModeEnterDialog({
  profileId,
  childName,
  className,
}: ChildModeEnterDialogProps) {
  const router = useRouter();
  const enter = useChildModeStore((s) => s.enter);
  const [isOpen, setIsOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setPin("");
    setError(null);
  };

  const handleEnter = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4) {
      setError("PIN harus 4 digit angka.");
      return;
    }

    setError(null);
    const supabase = createClient();

    startTransition(async () => {
      try {
        const { data: isValid, error: rpcError } = await verifyChildProfilePin(
          supabase,
          { p_profile_id: profileId, p_pin: pin },
        );

        if (rpcError) {
          setError(rpcError.message || "Gagal memverifikasi PIN.");
          return;
        }

        if (!isValid) {
          setError("PIN salah. Coba lagi atau ubah PIN di pengaturan profil anak.");
          return;
        }

        enter(profileId, childName);
        setIsOpen(false);
        reset();
        toast.success(`Mode Anak aktif untuk ${childName}`);
        router.push("/child/home");
      } catch {
        setError("Terjadi kesalahan sistem.");
      }
    });
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) reset();
      }}
    >
      <DialogTrigger
        data-compact
        className={cn(
          "inline-flex h-7 w-full cursor-pointer items-center justify-center gap-1 rounded-md border border-emerald-200 bg-emerald-700 text-[10px] font-bold text-white shadow-sm transition-colors hover:bg-emerald-800 select-none outline-none",
          className,
        )}
      >
        <Play className="h-3 w-3 fill-white" aria-hidden />
        Mode Anak
      </DialogTrigger>
      <DialogContent className="max-w-xs rounded-3xl border border-emerald-100 bg-white/95 backdrop-blur-md">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center justify-center gap-2 text-center text-lg font-bold text-slate-900">
            <Lock className="h-5 w-5 text-emerald-700" aria-hidden />
            Buka Mode Anak
          </DialogTitle>
          <DialogDescription className="text-center text-xs text-slate-500">
            Masukkan PIN child-lock milik <strong>{childName}</strong> untuk membuka sesi anak di
            perangkat ini.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleEnter} className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor={`enter-pin-${profileId}`} className="block text-center text-xs font-bold text-slate-800">
              PIN child-lock
            </Label>
            <Input
              id={`enter-pin-${profileId}`}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
              className="h-11 rounded-xl border-emerald-200 bg-white text-center text-xl font-bold tracking-widest focus-visible:ring-emerald-700"
              autoFocus
            />
          </div>

          {error ? (
            <p className="rounded-lg border border-red-100 bg-red-50 p-2 text-center text-xs font-semibold text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            data-compact
            disabled={isPending}
            className="h-10 w-full cursor-pointer rounded-xl bg-emerald-700 font-bold text-white hover:bg-emerald-800"
          >
            {isPending ? "Memverifikasi…" : "Masuk Mode Anak"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
