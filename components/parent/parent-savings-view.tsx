"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { PiggyBank, Plus, Check, X, BookOpen, Settings2 } from "lucide-react";
import type { ParentSavingsData } from "@/lib/savings/types";
import { ChildAvatar } from "@/components/shared/child-avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  createSavingsPocketAction,
  approveSavingsWithdrawAction,
  rejectSavingsWithdrawAction,
} from "@/app/parent/savings/actions";
import { cn } from "@/lib/utils";

type ParentSavingsViewProps = ParentSavingsData;

export function ParentSavingsView({
  children,
  pocketsByProfile,
  walletByProfile,
  pendingWithdrawals,
  savingsEnabled,
}: ParentSavingsViewProps) {
  const [activeChildId, setActiveChildId] = useState(children[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const activeChild = children.find((c) => c.id === activeChildId);
  const pockets = pocketsByProfile[activeChildId] ?? [];
  const wallet = walletByProfile[activeChildId] ?? 0;

  const handleCreatePocket = (formData: FormData) => {
    formData.set("profileId", activeChildId);
    startTransition(async () => {
      const res = await createSavingsPocketAction(formData);
      if (res.error) toast.error(res.error);
      else toast.success("Kantong tabungan dibuat.");
    });
  };

  const handleApprove = (txId: string) => {
    startTransition(async () => {
      const res = await approveSavingsWithdrawAction(txId);
      if (res.error) toast.error(res.error);
      else toast.success("Penarikan disetujui.");
    });
  };

  const handleReject = () => {
    if (!rejectId) return;
    startTransition(async () => {
      const res = await rejectSavingsWithdrawAction(rejectId, rejectReason);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Penarikan ditolak.");
        setRejectId(null);
        setRejectReason("");
      }
    });
  };

  if (!savingsEnabled) {
    return (
      <Card className="border-violet-100">
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          <PiggyBank className="size-10 text-violet-300" aria-hidden />
          <p className="text-sm text-muted-foreground">
            Tabungan digital dinonaktifkan untuk keluarga ini.
          </p>
          <Link
            href="/parent/settings/engagement"
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-xs hover:bg-accent hover:text-accent-foreground"
          >
            <Settings2 className="size-4" aria-hidden />
            Aktifkan di Pengaturan Engagement
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (children.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Tambahkan profil anak terlebih dahulu.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 pb-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link
          href="/parent/ledger"
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <BookOpen className="size-3.5" aria-hidden />
          Buku besar
        </Link>
      </div>

      {pendingWithdrawals.length > 0 ? (
        <Card className="border-amber-200 bg-amber-50/80">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-base">
              Menunggu persetujuan ({pendingWithdrawals.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingWithdrawals.map((w) => (
              <div
                key={w.id}
                className="flex flex-col gap-2 rounded-xl border border-amber-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold">
                    {w.pocket_emoji} {w.child_name} · {w.pocket_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Tarik {w.amount} energi
                    {w.note ? ` — ${w.note}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleApprove(w.id)}
                    className="gap-1"
                  >
                    <Check className="size-4" aria-hidden />
                    Setujui
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => setRejectId(w.id)}
                    className="gap-1"
                  >
                    <X className="size-4" aria-hidden />
                    Tolak
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {children.map((child) => {
          const selected = child.id === activeChildId;
          return (
            <button
              key={child.id}
              type="button"
              onClick={() => setActiveChildId(child.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                selected
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-border bg-card text-foreground",
              )}
            >
              <ChildAvatar name={child.name} avatarUrl={child.avatar_url} avatarPreference={child.avatar_preference} avatarEmoji={child.avatar_emoji} accentColor={child.home_card_accent ?? "#8B5CF6"} className="h-7 w-7 shrink-0 rounded-full text-xs" fallbackSizeClass="text-xs" />
              {child.name}
            </button>
          );
        })}
      </div>

      {activeChild ? (
        <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-3">
          <div>
            <p className="text-xs text-muted-foreground">Dompet energi</p>
            <p className="font-heading text-xl font-bold text-emerald-700">
              {wallet} ⚡
            </p>
          </div>
          <Dialog>
            <DialogTrigger className="inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-lg bg-violet-700 px-3 text-xs font-semibold text-white hover:bg-violet-800">
              <Plus className="size-4" aria-hidden />
              Kantong baru
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Kantong untuk {activeChild.name}</DialogTitle>
                <DialogDescription>
                  Anak bisa menabung energi dari dompet ke kantong ini.
                </DialogDescription>
              </DialogHeader>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleCreatePocket(new FormData(e.currentTarget));
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="pocket-name">Nama kantong</Label>
                  <Input
                    id="pocket-name"
                    name="name"
                    required
                    maxLength={40}
                    placeholder="Mis. Tabungan sepeda"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="pocket-emoji">Emoji</Label>
                    <Input
                      id="pocket-emoji"
                      name="emoji"
                      defaultValue="🐷"
                      maxLength={8}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pocket-target">Target (opsional)</Label>
                    <Input
                      id="pocket-target"
                      name="targetAmount"
                      type="number"
                      min={1}
                      placeholder="100"
                    />
                  </div>
                </div>
                <input type="hidden" name="accentColor" value="#8B5CF6" />
                <DialogFooter>
                  <Button type="submit" disabled={isPending}>
                    Buat kantong
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      ) : null}

      <div className="grid gap-3">
        {pockets.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
              <PiggyBank className="size-10 text-violet-400" aria-hidden />
              <p className="text-sm text-muted-foreground">
                Belum ada kantong. Buat kantong pertama untuk {activeChild?.name}.
              </p>
            </CardContent>
          </Card>
        ) : (
          pockets.map((pocket) => {
            const progress =
              pocket.target_amount && pocket.target_amount > 0
                ? Math.min(
                    100,
                    Math.round((pocket.balance / pocket.target_amount) * 100),
                  )
                : null;
            return (
              <Card key={pocket.id} className="overflow-hidden">
                <div
                  className="h-1"
                  style={{ backgroundColor: pocket.accent_color }}
                  aria-hidden
                />
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-heading text-lg font-semibold">
                        {pocket.emoji} {pocket.name}
                      </p>
                      <p className="text-2xl font-bold text-violet-700">
                        {pocket.balance} ⚡
                      </p>
                      {pocket.reserved > 0 ? (
                        <p className="text-xs text-amber-700">
                          {pocket.reserved} menunggu penarikan
                        </p>
                      ) : null}
                    </div>
                    {pocket.target_amount ? (
                      <span className="text-xs text-muted-foreground">
                        Target {pocket.target_amount}
                      </span>
                    ) : null}
                  </div>
                  {progress !== null ? (
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-violet-100">
                      <div
                        className="h-full rounded-full bg-violet-500 transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <Dialog open={!!rejectId} onOpenChange={(o) => !o && setRejectId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tolak penarikan</DialogTitle>
            <DialogDescription>
              Beri alasan singkat agar anak mengerti (opsional).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Alasan</Label>
            <Input
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Mis. nabung dulu sampai target tercapai"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectId(null)}>
              Batal
            </Button>
            <Button variant="destructive" disabled={isPending} onClick={handleReject}>
              Tolak penarikan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
