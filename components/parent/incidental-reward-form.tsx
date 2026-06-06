"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { giveIncidentalRewardAction } from "@/app/parent/engagement/actions";
import { TASK_CATEGORIES, type TaskCategory } from "@/lib/database/enums";
import type { ChildProfile, Goal } from "@/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChildTabSelector } from "@/components/parent/child-tab-selector";

const CATEGORY_LABELS: Record<TaskCategory, string> = {
  ibadah: "Ibadah",
  belajar: "Belajar",
  kebersihan: "Kebersihan",
  olahraga: "Olahraga",
  lainnya: "Lainnya",
};

type IncidentalRewardFormProps = {
  children: ChildProfile[];
  goalsByProfile: Record<string, Goal[]>;
  profileId: string;
  onProfileIdChange?: (childId: string) => void;
  onSuccess?: (result: { goal?: Goal }) => void;
  variant?: "card" | "plain";
};

export function IncidentalRewardForm({
  children,
  goalsByProfile,
  profileId,
  onProfileIdChange,
  onSuccess,
  variant = "card",
}: IncidentalRewardFormProps) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState<TaskCategory>("lainnya");
  const [hpToTarget, setHpToTarget] = useState(0);
  const [energyOnly, setEnergyOnly] = useState(5);
  const [goalId, setGoalId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeGoals = (goalsByProfile[profileId] ?? []).filter((g) => g.status === "active");
  const showChildTabs = children.length > 1 && onProfileIdChange;

  const resetForm = () => {
    setTitle("");
    setNote("");
    setCategory("lainnya");
    setHpToTarget(0);
    setEnergyOnly(5);
    setGoalId("");
    setFormError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (hpToTarget > 0 && !goalId) {
      setFormError("Pilih target aktif jika memberi HP.");
      return;
    }
    if (hpToTarget <= 0 && energyOnly <= 0) {
      setFormError("Isi minimal HP ke target atau energi bebas.");
      return;
    }

    startTransition(async () => {
      const res = await giveIncidentalRewardAction(
        profileId,
        title,
        note,
        category,
        hpToTarget,
        energyOnly,
        hpToTarget > 0 ? goalId : null,
      );
      if (res?.error) {
        setFormError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success("Reward insidental berhasil diberikan! 🎁");
      resetForm();
      onSuccess?.({ goal: res.goal });
    });
  };

  if (children.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Tambahkan profil anak terlebih dahulu.
      </p>
    );
  }

  const form = (
    <form onSubmit={handleSubmit} className="space-y-4">
      {showChildTabs ? (
        <ChildTabSelector
          profiles={children}
          activeChildId={profileId}
          onActiveChildIdChange={(id) => {
            onProfileIdChange?.(id);
            setGoalId("");
          }}
        />
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="inc-title" className="text-xs font-bold text-slate-800">
          Judul apresiasi
        </Label>
        <Input
          id="inc-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={80}
          placeholder="Contoh: Bantu adik tanpa diminta"
          className="h-9 rounded-xl border-amber-100 bg-white text-sm focus-visible:ring-amber-500"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="inc-note" className="text-xs font-bold text-slate-800">
          Catatan (opsional)
        </Label>
        <Input
          id="inc-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          placeholder="Detail singkat untuk anak"
          className="h-9 rounded-xl border-amber-100 bg-white text-sm focus-visible:ring-amber-500"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="inc-category" className="text-xs font-bold text-slate-800">
          Kategori
        </Label>
        <select
          id="inc-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as TaskCategory)}
          className="h-9 w-full rounded-xl border border-amber-100 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          {TASK_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORY_LABELS[cat]}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-3 space-y-3">
        <p className="text-[10px] font-semibold leading-relaxed text-amber-900/80">
          <strong className="font-bold">HP ke target</strong> langsung menambah progress hadiah aktif.
          <strong className="font-bold"> Energi bebas</strong> masuk buku besar tanpa mengikat target.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="inc-hp" className="text-xs font-bold text-slate-800">
              HP ke target (0–50)
            </Label>
            <Input
              id="inc-hp"
              type="number"
              min={0}
              max={50}
              value={hpToTarget}
              onChange={(e) => setHpToTarget(Number(e.target.value))}
              className="h-9 rounded-xl border-amber-100 bg-white text-sm focus-visible:ring-amber-500"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inc-energy" className="text-xs font-bold text-slate-800">
              Energi bebas (0–50)
            </Label>
            <Input
              id="inc-energy"
              type="number"
              min={0}
              max={50}
              value={energyOnly}
              onChange={(e) => setEnergyOnly(Number(e.target.value))}
              className="h-9 rounded-xl border-amber-100 bg-white text-sm focus-visible:ring-amber-500"
            />
          </div>
        </div>
      </div>

      {hpToTarget > 0 ? (
        <div className="space-y-1.5">
          <Label htmlFor="inc-goal" className="text-xs font-bold text-slate-800">
            Target aktif
          </Label>
          {activeGoals.length === 0 ? (
            <p className="rounded-lg border border-amber-100 bg-amber-50 p-2.5 text-xs text-amber-900">
              Tidak ada target aktif. Buat atau aktifkan target dulu, atau beri energi bebas saja.
            </p>
          ) : (
            <select
              id="inc-goal"
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
              required
              className="h-9 w-full rounded-xl border border-amber-100 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">— Pilih target —</option>
              {activeGoals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title} ({g.current_hp}/{g.target_hp} HP)
                </option>
              ))}
            </select>
          )}
        </div>
      ) : null}

      {formError ? (
        <p
          className="rounded-lg border border-red-100 bg-red-50 p-2.5 text-center text-xs font-semibold text-red-600"
          role="alert"
        >
          {formError}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={isPending || (hpToTarget > 0 && activeGoals.length === 0)}
        className="h-10 w-full rounded-xl bg-amber-600 text-sm font-bold text-white hover:bg-amber-700 cursor-pointer"
      >
        {isPending ? "Memproses…" : "Berikan reward"}
      </Button>
    </form>
  );

  if (variant === "plain") {
    return form;
  }

  return (
    <Card className="rounded-3xl border-amber-100 bg-white shadow-sm">
      <CardContent className="space-y-4 p-5">{form}</CardContent>
    </Card>
  );
}
