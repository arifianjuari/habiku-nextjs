"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Sparkles, PiggyBank, Coins } from "lucide-react";
import { ParentPageHeaderSync } from "@/components/layout/parent-page-header-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { updateFamilySettingsAction } from "@/app/parent/settings/engagement/actions";
import { WebPushSubscriber } from "@/components/shared/web-push-subscriber";

interface EngagementSettingsViewProps {
  initialSettings: {
    family_id: string;
    micro_anim_enabled: boolean;
    featured_multiplier: "1.5x" | "2x" | "3x";
    daily_tip_enabled: boolean;
    show_sibling_highlight: boolean;
    check_in_reminder_enabled: boolean;
    family_garden_enabled: boolean;
    savings_enabled: boolean;
    goal_save_enabled?: boolean;
    savings_interest_enabled?: boolean;
    gold_savings_enabled?: boolean;
  };
}

function SettingsSwitch({
  checked,
  onToggle,
  accent = "emerald",
}: {
  checked: boolean;
  onToggle: () => void;
  accent?: "emerald" | "violet";
}) {
  const onClass = accent === "violet" ? "bg-violet-600" : "bg-emerald-700";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      className={`relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
        checked ? onClass : "bg-slate-300"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
          checked ? "translate-x-4.5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export function EngagementSettingsView({ initialSettings }: EngagementSettingsViewProps) {
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  const [microAnim, setMicroAnim] = useState(initialSettings.micro_anim_enabled);
  const [multiplier, setMultiplier] = useState<"1.5x" | "2x" | "3x">(
    initialSettings.featured_multiplier,
  );
  const [dailyTip, setDailyTip] = useState(initialSettings.daily_tip_enabled);
  const [siblingHighlight, setSiblingHighlight] = useState(
    initialSettings.show_sibling_highlight,
  );
  const [checkInReminder, setCheckInReminder] = useState(
    initialSettings.check_in_reminder_enabled,
  );
  const [familyGarden, setFamilyGarden] = useState(initialSettings.family_garden_enabled);
  const [savingsEnabled, setSavingsEnabled] = useState(
    initialSettings.savings_enabled ?? true,
  );
  const [goalSaveEnabled, setGoalSaveEnabled] = useState(
    initialSettings.goal_save_enabled ?? true,
  );
  const [savingsInterestEnabled, setSavingsInterestEnabled] = useState(
    initialSettings.savings_interest_enabled ?? true,
  );
  const [goldSavingsEnabled, setGoldSavingsEnabled] = useState(
    initialSettings.gold_savings_enabled ?? false,
  );

  const handleSave = () => {
    startTransition(async () => {
      const res = await updateFamilySettingsAction(
        microAnim,
        multiplier,
        dailyTip,
        siblingHighlight,
        checkInReminder,
        familyGarden,
        savingsEnabled,
        goalSaveEnabled,
        savingsInterestEnabled,
        goldSavingsEnabled,
      );

      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success("Pengaturan keterlibatan berhasil disimpan! 🎯");
        void queryClient.invalidateQueries({ queryKey: ["parent"] });
        void queryClient.invalidateQueries({ queryKey: ["child"] });
      }
    });
  };

  return (
    <div className="space-y-4">
      <ParentPageHeaderSync
        title="Fitur Engagement"
        description="Sesuaikan intensitas gamifikasi, tabungan, dan notifikasi keluarga."
        backHref="/parent/settings"
        backLabel="Kembali ke pengaturan"
      />

      <Card className="border border-slate-150 shadow-sm rounded-3xl bg-white overflow-hidden">
        <div className="h-2 w-full bg-gradient-to-r from-emerald-600 to-teal-500" />
        <CardContent className="p-5 space-y-6">
          <div className="space-y-3 pb-4 border-b border-slate-100">
            <div className="space-y-1">
              <Label className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-amber-500 fill-amber-50" />
                Multiplier Energi Misi Sorotan
              </Label>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Misi Sorotan harian memberikan poin bonus kepada anak. Pilih multiplier bonus
                energi yang didapatkan.
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

          <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-100">
            <div className="space-y-0.5 max-w-[80%]">
              <span className="text-xs font-bold text-slate-900 block">
                Animasi Selebrasi Mikro
              </span>
              <span className="text-[9px] text-slate-500 block leading-relaxed">
                Aktifkan efek semburan partikel emas saat misi disetujui.
              </span>
            </div>
            <SettingsSwitch checked={microAnim} onToggle={() => setMicroAnim(!microAnim)} />
          </div>

          <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-100">
            <div className="space-y-0.5 max-w-[80%]">
              <span className="text-xs font-bold text-slate-900 block">
                Tip Pengasuhan Harian
              </span>
              <span className="text-[9px] text-slate-500 block leading-relaxed">
                Kutipan parenting edukatif di beranda anak.
              </span>
            </div>
            <SettingsSwitch checked={dailyTip} onToggle={() => setDailyTip(!dailyTip)} />
          </div>

          <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-100">
            <div className="space-y-0.5 max-w-[80%]">
              <span className="text-xs font-bold text-slate-900 block">
                Highlight Saudara
              </span>
              <span className="text-[9px] text-slate-500 block leading-relaxed">
                Perbandingan kemajuan saudara di beranda anak.
              </span>
            </div>
            <SettingsSwitch
              checked={siblingHighlight}
              onToggle={() => setSiblingHighlight(!siblingHighlight)}
            />
          </div>

          <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-100">
            <div className="space-y-0.5 max-w-[80%]">
              <span className="text-xs font-bold text-slate-900 block">
                Pengingat Check-in
              </span>
              <span className="text-[9px] text-slate-500 block leading-relaxed">
                Pengingat PWA jika anak belum check-in di sore hari.
              </span>
            </div>
            <SettingsSwitch
              checked={checkInReminder}
              onToggle={() => setCheckInReminder(!checkInReminder)}
            />
          </div>

          <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-100">
            <div className="space-y-0.5 max-w-[80%]">
              <span className="text-xs font-bold text-slate-900 block">Kebun Energi</span>
              <span className="text-[9px] text-slate-500 block leading-relaxed">
                Galeri piala & target selesai di beranda anak.
              </span>
            </div>
            <SettingsSwitch
              checked={familyGarden}
              onToggle={() => setFamilyGarden(!familyGarden)}
            />
          </div>

          <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-100">
            <div className="space-y-0.5 max-w-[80%]">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <PiggyBank className="h-4 w-4 text-violet-600" aria-hidden />
                Tabungan digital (Kantong)
              </span>
              <span className="text-[9px] text-slate-500 block leading-relaxed">
                Menu Tabungan untuk ortu dan anak. Nonaktifkan jika keluarga belum siap.
              </span>
            </div>
            <SettingsSwitch
              checked={savingsEnabled}
              onToggle={() => setSavingsEnabled(!savingsEnabled)}
              accent="violet"
            />
          </div>

          <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-100">
            <div className="space-y-0.5 max-w-[80%]">
              <span className="text-xs font-bold text-slate-900 block">
                Tabung dari Target Hadiah
              </span>
              <span className="text-[9px] text-slate-500 block leading-relaxed">
                Saat target penuh, anak bisa memilih menabung energi ke kantong (bukan langsung
                selesai).
              </span>
            </div>
            <SettingsSwitch
              checked={goalSaveEnabled}
              onToggle={() => setGoalSaveEnabled(!goalSaveEnabled)}
              accent="violet"
            />
          </div>

          <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-100">
            <div className="space-y-0.5 max-w-[80%]">
              <span className="text-xs font-bold text-slate-900 block">Bunga Tabungan</span>
              <span className="text-[9px] text-slate-500 block leading-relaxed">
                Akrual bunga bulanan pada saldo kantong sesuai pengaturan ortu.
              </span>
            </div>
            <SettingsSwitch
              checked={savingsInterestEnabled}
              onToggle={() => setSavingsInterestEnabled(!savingsInterestEnabled)}
              accent="violet"
            />
          </div>

          <div className="flex items-start justify-between gap-4 py-2">
            <div className="space-y-0.5 max-w-[80%]">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Coins className="h-4 w-4 text-amber-500" aria-hidden />
                Tabung Emas
              </span>
              <span className="text-[9px] text-slate-500 block leading-relaxed">
                Anak bisa beli/jual emas virtual dengan energi; ortu tentukan harga beli dan jual.
              </span>
            </div>
            <SettingsSwitch
              checked={goldSavingsEnabled}
              onToggle={() => setGoldSavingsEnabled(!goldSavingsEnabled)}
              accent="violet"
            />
          </div>
        </CardContent>
      </Card>

      <WebPushSubscriber />

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
