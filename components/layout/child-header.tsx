"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useChildModeStore } from "@/lib/stores/child-mode-store";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock } from "lucide-react";

export function ChildHeader() {
  const router = useRouter();
  const profileId = useChildModeStore((s) => s.profileId);
  const profileName = useChildModeStore((s) => s.profileName);
  const exit = useChildModeStore((s) => s.exit);

  const [pin, setPin] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleExitVerification = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileId) {
      toast.error("ID profil anak tidak valid.");
      return;
    }
    if (pin.length < 4) {
      setError("PIN harus berupa 4 digit angka.");
      return;
    }

    setError(null);
    const supabase = createClient();

    startTransition(async () => {
      try {
        const { data: isValid, error: rpcError } = await (supabase as any).rpc("verify_child_profile_pin", {
          p_profile_id: profileId,
          p_pin: pin,
        });

        if (rpcError) {
          setError(rpcError.message || "Gagal memverifikasi PIN.");
          toast.error(rpcError.message || "Gagal memverifikasi PIN.");
        } else if (!isValid) {
          setError("PIN salah. Silakan minta bantuan Papa atau Mama!");
        } else {
          // Success! Clear cookie and exit child mode
          document.cookie = "habiku_child_mode=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
          exit();
          toast.success("Berhasil keluar dari Mode Anak.");
          setIsOpen(false);
          router.replace("/parent/profil-anak");
        }
      } catch (err) {
        console.error(err);
        setError("Terjadi kesalahan sistem.");
      }
    });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-emerald-200/80 bg-emerald-50/90 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-emerald-700">Mode Anak</p>
          <p className="font-heading text-lg font-semibold text-emerald-900">
            {profileName ?? "Anak"}
          </p>
        </div>

        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); setError(null); setPin(""); }}>
          <DialogTrigger className="inline-flex items-center justify-center rounded-xl border border-emerald-200 text-emerald-800 bg-white hover:bg-emerald-50/50 cursor-pointer font-bold text-xs px-3 h-8 shadow-sm transition-all duration-200">
            Keluar
          </DialogTrigger>
          <DialogContent className="max-w-xs rounded-3xl border border-violet-100 bg-white/95 backdrop-blur-md">
            <DialogHeader>
              <DialogTitle className="font-heading text-lg font-bold text-center flex items-center justify-center gap-2 text-slate-900">
                <Lock className="h-5 w-5 text-violet-700" />
                Keluar Mode Anak
              </DialogTitle>
              <DialogDescription className="text-center text-xs text-slate-500">
                Masukkan PIN anak milik <strong>{profileName}</strong> untuk kembali ke Dasbor Orang Tua.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleExitVerification} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="exit-pin" className="text-xs font-bold text-slate-800 text-center block">PIN Pengaman Anak</Label>
                <Input
                  id="exit-pin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••"
                  className="border-violet-200 focus-visible:ring-violet-700 h-12 tracking-widest text-center text-xl font-bold rounded-xl bg-white"
                  autoFocus
                />
              </div>

              {error && (
                <p className="text-xs font-semibold text-red-650 text-center bg-red-50 p-2.5 rounded-lg border border-red-100" role="alert">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={isPending}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-11 rounded-xl shadow-md cursor-pointer"
              >
                {isPending ? "Memverifikasi PIN..." : "Konfirmasi Keluar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </header>
  );
}
