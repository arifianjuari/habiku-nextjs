"use client";

import { useState, useTransition } from "react";
import { useChildModeStore } from "@/lib/stores/child-mode-store";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Smile,
  Compass,
  ArrowLeft,
  PenTool,
  CheckCircle2,
  Sparkles,
  Heart,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { submitChildReflectionAction } from "@/app/child/actions";
import Link from "next/link";

interface MoodOption {
  key: "sangat_senang" | "senang" | "biasa" | "kurang_senang";
  emoji: string;
  label: string;
  color: string;
  borderActive: string;
  bgActive: string;
}

const MOODS: MoodOption[] = [
  {
    key: "sangat_senang",
    emoji: "😄",
    label: "Sangat Senang",
    color: "text-emerald-600 bg-emerald-50",
    borderActive: "border-emerald-450 border-emerald-400 bg-emerald-50/30",
    bgActive: "bg-emerald-500",
  },
  {
    key: "senang",
    emoji: "🙂",
    label: "Senang",
    color: "text-sky-600 bg-sky-50",
    borderActive: "border-sky-400 bg-sky-50/30",
    bgActive: "bg-sky-500",
  },
  {
    key: "biasa",
    emoji: "😐",
    label: "Biasa Saja",
    color: "text-amber-600 bg-amber-50",
    borderActive: "border-amber-400 bg-amber-50/30",
    bgActive: "bg-amber-500",
  },
  {
    key: "kurang_senang",
    emoji: "😟",
    label: "Kurang Senang",
    color: "text-rose-600 bg-rose-50",
    borderActive: "border-rose-400 bg-rose-50/30",
    bgActive: "bg-rose-500",
  },
];

export function ChildReflectionView() {
  const { profileId, profileName } = useChildModeStore();
  const [selectedMood, setSelectedMood] = useState<"sangat_senang" | "senang" | "biasa" | "kurang_senang" | null>(null);
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSendReflection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileId) {
      toast.error("ID profil anak tidak valid.");
      return;
    }
    if (!selectedMood) {
      toast.error("Silakan pilih perasaanmu hari ini!");
      return;
    }

    startTransition(async () => {
      const res = await submitChildReflectionAction(profileId, selectedMood, note);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success("Refleksi soremu berhasil dikirim! 🌅");
        setSubmitted(true);
      }
    });
  };

  if (submitted) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-6 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: [0.8, 1.1, 1], opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 shadow-lg border border-emerald-100"
        >
          <CheckCircle2 className="h-10 w-10" />
        </motion.div>

        <div className="space-y-2">
          <h2 className="font-heading text-2xl font-black text-slate-900 tracking-tight">
            Refleksi Sore Terkirim! 🌅
          </h2>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
            Terima kasih telah berbagi perasaanmu hari ini, **{profileName}**! Papa dan Mama sangat senang mendengar ceritamu.
          </p>
        </div>

        <motion.div
          animate={{ y: [0, -4, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="rounded-2xl border border-violet-100 bg-violet-50/30 p-3.5 flex gap-2.5 items-center justify-center text-[10px] text-violet-850 font-bold max-w-xs"
        >
          <Heart className="h-4 w-4 text-violet-600 fill-violet-200" />
          <span>Kamu mendapatkan +1 Bonus Atribut Kejujuran! 🌟</span>
        </motion.div>

        <Link href="/child/home" className="w-full max-w-xs">
          <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-11 rounded-xl shadow-md cursor-pointer">
            Kembali ke Beranda
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Navigation Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/child/home"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 bg-white text-slate-600 transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 leading-none mb-1">
            Refleksi Sore 🌅
          </h2>
          <p className="text-xs text-muted-foreground">
            Luapkan perasaan dan petualangan hebatmu hari ini.
          </p>
        </div>
      </div>

      {/* 2. Form Panel */}
      <Card className="border border-violet-100 bg-white/70 backdrop-blur-md rounded-3xl shadow-sm overflow-hidden">
        <div className="h-2 w-full bg-gradient-to-r from-violet-500 to-indigo-500" />
        <CardContent className="p-5 space-y-6">
          <form onSubmit={handleSendReflection} className="space-y-6">
            
            {/* Mood selector grid */}
            <div className="space-y-3">
              <Label className="text-xs font-bold text-slate-850 flex items-center gap-1">
                <Smile className="h-4 w-4 text-violet-600" />
                Bagaimana perasaanmu hari ini?
              </Label>
              
              <div className="grid grid-cols-2 gap-3">
                {MOODS.map((mood) => {
                  const isActive = selectedMood === mood.key;
                  return (
                    <motion.button
                      key={mood.key}
                      type="button"
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedMood(mood.key)}
                      className={`flex flex-col items-center justify-center p-4 rounded-2xl border text-center transition-all cursor-pointer ${
                        isActive
                          ? `bg-white shadow-md ${mood.borderActive}`
                          : "bg-white/60 hover:bg-white border-slate-200"
                      }`}
                    >
                      <span className="text-3xl mb-1.5 shrink-0 block">{mood.emoji}</span>
                      <span className="text-[10px] font-extrabold text-slate-800 leading-none">
                        {mood.label}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Reflection Note */}
            <div className="space-y-1.5">
              <Label htmlFor="note" className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <PenTool className="h-4 w-4 text-violet-600" />
                Catatan Petualangan (Opsional)
              </Label>
              <div className="relative">
                <textarea
                  id="note"
                  maxLength={280}
                  placeholder="Ceritakan kejadian seru, kesulitan, atau hal menarik yang kamu alami hari ini..."
                  value={note}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNote(e.target.value)}
                  className="w-full flex min-h-[96px] rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-700 placeholder:text-slate-400 leading-relaxed"
                />
                <span className="absolute bottom-2 right-3 text-[9px] text-slate-400 font-bold">
                  {note.length} / 280
                </span>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isPending}
              className="w-full bg-violet-700 hover:bg-violet-800 text-white font-bold h-12 rounded-2xl shadow-lg cursor-pointer flex items-center justify-center gap-2"
            >
              <Sparkles className="h-4.5 w-4.5 text-amber-300 fill-amber-300 animate-pulse" />
              {isPending ? "Mengirim..." : "Kirim Refleksiku 🚀"}
            </Button>

          </form>
        </CardContent>
      </Card>
    </div>
  );
}
