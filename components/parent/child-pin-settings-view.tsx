"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Lock, UserPlus, ChevronRight } from "lucide-react";
import { ParentPageHeaderSync } from "@/components/layout/parent-page-header-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChildAvatar } from "@/components/shared/child-avatar";
import { updateChildPinAction } from "@/app/parent/settings/child-pin/actions";
import type { ChildProfile } from "@/types/database";

type ChildPinSettingsViewProps = {
  initialChildren: ChildProfile[];
};

export function ChildPinSettingsView({ initialChildren }: ChildPinSettingsViewProps) {
  const [pins, setPins] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSavePin = (child: ChildProfile) => {
    const pin = pins[child.id] ?? "";
    if (pin.length < 4) {
      toast.error("PIN harus 4 digit angka.");
      return;
    }

    setSavingId(child.id);
    startTransition(async () => {
      const res = await updateChildPinAction(child.id, pin);
      setSavingId(null);

      if (res?.error) {
        toast.error(res.error);
        return;
      }

      toast.success(`PIN ${child.name} berhasil diperbarui.`);
      setPins((prev) => {
        const next = { ...prev };
        delete next[child.id];
        return next;
      });
    });
  };

  return (
    <>
      <ParentPageHeaderSync
        title="PIN Child-lock"
        description="PIN 4 digit per anak untuk masuk dan keluar Mode Anak di perangkat ini."
      />

      <Card className="overflow-hidden rounded-2xl border border-emerald-100 bg-emerald-50/40 py-0 shadow-sm">
        <CardContent className="space-y-1 p-3 text-[11px] leading-snug text-emerald-900">
          <p className="flex items-start gap-1.5 font-semibold">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            PIN ini diketahui orang tua dan dipakai anak saat keluar dari Mode Anak.
          </p>
          <p className="text-[10px] text-emerald-800/80">
            Ubah PIN di bawah tanpa harus membuka seluruh formulir profil.
          </p>
        </CardContent>
      </Card>

      {initialChildren.length === 0 ? (
        <Card className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
            <p className="text-xs text-muted-foreground">
              Belum ada profil anak. Buat profil dulu untuk mengatur PIN child-lock.
            </p>
            <Link
              href="/parent/profil-anak"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-700 px-4 text-xs font-bold text-white hover:bg-emerald-800"
            >
              <UserPlus className="h-4 w-4" aria-hidden />
              Tambah profil anak
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {initialChildren.map((child) => {
            const accent = child.home_card_accent || "#8B5CF6";
            const pinValue = pins[child.id] ?? "";
            const isSaving = isPending && savingId === child.id;

            return (
              <Card
                key={child.id}
                size="sm"
                className="gap-0 overflow-hidden rounded-2xl border bg-white py-0 shadow-sm data-[size=sm]:py-0"
                style={{ borderColor: `${accent}25` }}
              >
                <CardContent className="space-y-2 p-3">
                  <div className="flex items-center gap-2">
                    <ChildAvatar
                      name={child.name}
                      avatarUrl={child.avatar_url}
                      avatarPreference={child.avatar_preference}
                      avatarEmoji={child.avatar_emoji}
                      accentColor={accent}
                      className="h-9 w-9 shrink-0 rounded-lg text-sm font-bold text-white"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-slate-900">{child.name}</p>
                      <p className="text-[9px] text-muted-foreground">PIN saat ini terenkripsi</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor={`pin-${child.id}`} className="text-[10px] font-bold text-slate-700">
                      PIN baru (4 digit)
                    </Label>
                    <Input
                      id={`pin-${child.id}`}
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      value={pinValue}
                      onChange={(e) =>
                        setPins((prev) => ({
                          ...prev,
                          [child.id]: e.target.value.replace(/\D/g, ""),
                        }))
                      }
                      placeholder="••••"
                      className="h-9 rounded-lg border-slate-200 bg-white text-center text-base font-bold tracking-widest"
                    />
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    data-compact
                    disabled={isSaving || pinValue.length < 4}
                    onClick={() => handleSavePin(child)}
                    className="h-8 w-full cursor-pointer rounded-lg bg-emerald-700 text-xs font-bold text-white hover:bg-emerald-800"
                  >
                    {isSaving ? "Menyimpan…" : `Simpan PIN ${child.name.split(" ")[0]}`}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Link
        href="/parent/profil-anak"
        className="flex items-center justify-between rounded-2xl border border-slate-150 bg-white p-3 shadow-sm transition-colors hover:bg-slate-50"
      >
        <span className="text-xs font-bold text-slate-800">Kelola profil anak lengkap</span>
        <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden />
      </Link>
    </>
  );
}
