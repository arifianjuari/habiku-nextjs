"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Compass,
  ArrowLeft,
  Zap,
  Sparkles,
  Smile,
  Flame,
  Award,
  Bell,
  CheckCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { updateFamilySettingsAction } from "@/app/parent/settings/engagement/actions";
import Link from "next/link";
import { WebPushSubscriber } from "@/components/shared/web-push-subscriber";
import { FsdAgreementCard } from "@/components/parent/fsd-agreement-card";

interface EngagementSettingsViewProps {
  initialSettings: {
    family_id: string;
    micro_anim_enabled: boolean;
    featured_multiplier: "1.5x" | "2x" | "3x";
    daily_tip_enabled: boolean;
    show_sibling_highlight: boolean;
    check_in_reminder_enabled: boolean;
    family_garden_enabled: boolean;
  };
}

export function EngagementSettingsView({ initialSettings }: EngagementSettingsViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [microAnim, setMicroAnim] = useState(initialSettings.micro_anim_enabled);
  const [multiplier, setMultiplier] = useState<"1.5x" | "2x" | "3x">(initialSettings.featured_multiplier);
  const [dailyTip, setDailyTip] = useState(initialSettings.daily_tip_enabled);
  const [siblingHighlight, setSiblingHighlight] = useState(initialSettings.show_sibling_highlight);
  const [checkInReminder, setCheckInReminder] = useState(initialSettings.check_in_reminder_enabled);
  const [familyGarden, setFamilyGarden] = useState(initialSettings.family_garden_enabled);

  const handleSave = () => {
    startTransition(async () => {
      const res = await updateFamilySettingsAction(
        microAnim,
        multiplier,
        dailyTip,
        siblingHighlight,
        checkInReminder,
        familyGarden
      );

      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success("Pengaturan keterlibatan berhasil disimpan! 🎯");
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Back Navigation */}
      <div className="flex items-center gap-3">
        <Link
          href="/parent/settings"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 bg-white text-slate-600 transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 leading-none mb-1">
            Fitur Engagement
          </h2>
          <p className="text-xs text-muted-foreground">
            Sesuaikan intensitas gamifikasi dan notifikasi keterlibatan keluarga.
          </p>
        </div>
      </div>

      {/* 2. Settings Card */}
      <Card className="border border-slate-150 shadow-sm rounded-3xl bg-white overflow-hidden">
        <div className="h-2 w-full bg-gradient-to-r from-emerald-600 to-teal-500" />
        <CardContent className="p-5 space-y-6">
          
          {/* Misi Sorotan Multiplier Selector */}
          <div className="space-y-3 pb-4 border-b border-slate-100">
            <div className="space-y-1">
              <Label className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-amber-500 fill-amber-50" />
                Multiplier Energi Misi Sorotan
              </Label>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Misi Sorotan harian memberikan poin bonus kepada anak. Pilih multiplier bonus energi yang didapatkan.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(["1.5x", "2x", "3x"] as const).map((opt) => {
                const isActive = opt === multiplier;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setMultiplier(opt)}
                    className={`flex items-center justify-center h-10 rounded-xl border font-black text-sm transition-all cursor-pointer ${
                      isActive
                        ? "bg-emerald-700 border-emerald-700 text-white shadow-md shadow-emerald-700/10"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Toggle 1: Micro Animations */}
          <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-100">
            <div className="space-y-0.5 max-w-[80%]">
              <span className="text-xs font-bold text-slate-900 block">Animasi Selebrasi Mikro</span>
              <span className="text-[9px] text-slate-500 block leading-relaxed">
                Aktifkan efek semburan partikel emas dan selebrasi visual (Framer Motion) saat misi disetujui.
              </span>
            </div>
            <button
              onClick={() => setMicroAnim(!microAnim)}
              className={`relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none shrink-0 ${
                microAnim ? "bg-emerald-700" : "bg-slate-350 bg-slate-300"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                  microAnim ? "translate-x-4.5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Toggle 2: Daily Tip strip */}
          <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-100">
            <div className="space-y-0.5 max-w-[80%]">
              <span className="text-xs font-bold text-slate-900 block">Tip Pengasuhan Harian (Daily Tips)</span>
              <span className="text-[9px] text-slate-500 block leading-relaxed">
                Tampilkan kutipan dan petunjuk parenting edukatif di bagian bawah beranda anak untuk menginspirasi kebiasaan.
              </span>
            </div>
            <button
              onClick={() => setDailyTip(!dailyTip)}
              className={`relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none shrink-0 ${
                dailyTip ? "bg-emerald-700" : "bg-slate-300"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                  dailyTip ? "translate-x-4.5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Toggle 3: Sibling Highlight */}
          <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-100">
            <div className="space-y-0.5 max-w-[80%]">
              <span className="text-xs font-bold text-slate-900 block">Highlight Saudara (Sibling Progress)</span>
              <span className="text-[9px] text-slate-500 block leading-relaxed">
                Tampilkan perbandingan kemajuan saudaranya secara ramah untuk memperkuat motivasi tim co-op.
              </span>
            </div>
            <button
              onClick={() => setSiblingHighlight(!siblingHighlight)}
              className={`relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none shrink-0 ${
                siblingHighlight ? "bg-emerald-700" : "bg-slate-300"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                  siblingHighlight ? "translate-x-4.5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Toggle 4: Check-in Reminder */}
          <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-100">
            <div className="space-y-0.5 max-w-[80%]">
              <span className="text-xs font-bold text-slate-900 block">Pengingat Notifikasi Check-in</span>
              <span className="text-[9px] text-slate-500 block leading-relaxed">
                Kirim pengingat check-in harian otomatis ke browser/PWA jika anak belum log in di sore hari.
              </span>
            </div>
            <button
              onClick={() => setCheckInReminder(!checkInReminder)}
              className={`relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none shrink-0 ${
                checkInReminder ? "bg-emerald-700" : "bg-slate-300"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                  checkInReminder ? "translate-x-4.5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Toggle 5: Kebun Energi */}
          <div className="flex items-start justify-between gap-4 py-2">
            <div className="space-y-0.5 max-w-[80%]">
              <span className="text-xs font-bold text-slate-900 block">Visualisasi Kebun Energi</span>
              <span className="text-[9px] text-slate-500 block leading-relaxed">
                Tampilkan galeri piala & target hadiah selesai di beranda anak sebagai penghargaan jangka panjang.
              </span>
            </div>
            <button
              onClick={() => setFamilyGarden(!familyGarden)}
              className={`relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none shrink-0 ${
                familyGarden ? "bg-emerald-700" : "bg-slate-300"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                  familyGarden ? "translate-x-4.5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

        </CardContent>
      </Card>

      {/* Web Push Subscriber Panel */}
      <WebPushSubscriber />

      {/* 3. Action Save Button */}
      <Button
        onClick={handleSave}
        disabled={isPending}
        className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold h-12 rounded-2xl shadow-lg cursor-pointer"
      >
        {isPending ? "Menyimpan Setelan..." : "Simpan Pengaturan Keterlibatan"}
      </Button>
    </div>
  );
}

