"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Gift } from "lucide-react";
import { giveIncidentalRewardAction } from "@/app/parent/engagement/actions";
import { TASK_CATEGORIES, type TaskCategory } from "@/lib/database/enums";
import type { ChildProfile, Goal } from "@/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
};

export function IncidentalRewardForm({ children, goalsByProfile }: IncidentalRewardFormProps) {
  const [profileId, setProfileId] = useState(children[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState<TaskCategory>("lainnya");
  const [hpToTarget, setHpToTarget] = useState(0);
  const [energyOnly, setEnergyOnly] = useState(5);
  const [goalId, setGoalId] = useState("");
  const [isPending, startTransition] = useTransition();

  const activeGoals = (goalsByProfile[profileId] ?? []).filter((g) => g.status === "active");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await giveIncidentalRewardAction(
        profileId,
        title,
        note,
        category,
        hpToTarget,
        energyOnly,
        hpToTarget > 0 ? goalId || null : null,
      );
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Reward insidental berhasil diberikan! 🎁");
      setTitle("");
      setNote("");
      setHpToTarget(0);
      setEnergyOnly(5);
    });
  };

  if (children.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Tambahkan profil anak terlebih dahulu.
      </p>
    );
  }

  return (
    <Card className="rounded-3xl border-amber-100 bg-white shadow-sm">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-amber-600" aria-hidden />
          <h3 className="font-bold text-slate-900">Reward insidental</h3>
        </div>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Apresiasi kilat di luar misi rutin — langsung masuk ledger &amp; HP target (jika dipilih).
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="inc-child">Anak</Label>
            <select
              id="inc-child"
              value={profileId}
              onChange={(e) => {
                setProfileId(e.target.value);
                setGoalId("");
              }}
              className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              {children.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="inc-title">Judul</Label>
            <Input
              id="inc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={80}
              placeholder="Contoh: Bantu adik tanpa diminta"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="inc-note">Catatan (opsional)</Label>
            <Input
              id="inc-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="inc-category">Kategori</Label>
            <select
              id="inc-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as TaskCategory)}
              className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
            >
              {TASK_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="inc-hp">HP ke target (0–50)</Label>
              <Input
                id="inc-hp"
                type="number"
                min={0}
                max={50}
                value={hpToTarget}
                onChange={(e) => setHpToTarget(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inc-energy">Energi bebas (0–50)</Label>
              <Input
                id="inc-energy"
                type="number"
                min={0}
                max={50}
                value={energyOnly}
                onChange={(e) => setEnergyOnly(Number(e.target.value))}
              />
            </div>
          </div>

          {hpToTarget > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="inc-goal">Target aktif</Label>
              <select
                id="inc-goal"
                value={goalId}
                onChange={(e) => setGoalId(e.target.value)}
                required
                className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
              >
                <option value="">— Pilih target —</option>
                {activeGoals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title} ({g.current_hp}/{g.target_hp} HP)
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button
            type="submit"
            disabled={isPending}
            className="w-full h-11 rounded-xl font-bold cursor-pointer"
          >
            {isPending ? "Memproses…" : "Berikan reward"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
