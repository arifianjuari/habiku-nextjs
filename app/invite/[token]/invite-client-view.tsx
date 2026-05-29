"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { acceptFamilyInviteAction } from "@/app/invite/actions";
import { Sparkles, Users, ArrowRight } from "lucide-react";

interface InviteClientViewProps {
  token: string;
  familyName: string;
}

export function InviteClientView({ token, familyName }: InviteClientViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleAcceptInvite = () => {
    startTransition(async () => {
      const res = await acceptFamilyInviteAction(token);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(`Selamat! Anda telah bergabung dengan ${familyName} 🎉`);
        router.push("/parent");
      }
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 text-center"
    >
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-700 shadow-inner">
        <Users className="h-8 w-8 animate-pulse" />
      </div>

      <div className="space-y-2">
        <h2 className="font-heading text-2xl font-black text-slate-900 tracking-tight">
          Bergabung dengan {familyName}! ✨
        </h2>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
          Anda diundang oleh pasangan/keluarga Anda untuk menjadi **Orang Tua Kedua (Secondary Parent)**. Kelola misi harian, setujui tugas, dan salurkan reward energi bersama!
        </p>
      </div>

      <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/10 p-4 max-w-sm mx-auto">
        <span className="text-xs font-bold text-emerald-800 block mb-1">
          Kolaborasi Pengasuhan RPG
        </span>
        <span className="text-[10px] text-slate-500 block leading-relaxed">
          Kedua orang tua dapat mengakses dasbor yang sama, memantau kemajuan anak secara realtime, dan meninjau unggahan bukti misi.
        </span>
      </div>

      <Button
        onClick={handleAcceptInvite}
        disabled={isPending}
        className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold h-12 rounded-2xl shadow-lg shadow-emerald-700/10 cursor-pointer flex items-center justify-center gap-2"
      >
        {isPending ? "Sedang Bergabung..." : "Terima Undangan & Mulai"}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </motion.div>
  );
}
