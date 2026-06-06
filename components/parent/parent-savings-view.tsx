"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { PiggyBank, Plus, Check, X, BookOpen, Settings2, Gift, Lock } from "lucide-react";
import type { ParentSavingsData } from "@/lib/savings/types";
import { ChildTabSelector } from "@/components/parent/child-tab-selector";
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
} from "@/components/ui/dialog";
import {
  createSavingsPocketAction,
  approveSavingsWithdrawAction,
  rejectSavingsWithdrawAction,
  approveGoalClaimAction,
  rejectGoalClaimAction,
} from "@/app/parent/savings/actions";
import { formatInterestBps, effectiveMonthlyBps } from "@/lib/savings/interest";
import { cn } from "@/lib/utils";

type ParentSavingsViewProps = ParentSavingsData;

export function ParentSavingsView({
  children,
  pocketsByProfile,
  savableByProfile,
  pendingWithdrawals,
  pendingGoalClaims,
  savingsEnabled,
  maxMonthlyInterestBps,
}: ParentSavingsViewProps) {
  const router = useRouter();
  const [activeChildId, setActiveChildId] = useState(children[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const [rejectWithdrawId, setRejectWithdrawId] = useState<string | null>(null);
  const [rejectClaimId, setRejectClaimId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [createPocketOpen, setCreatePocketOpen] = useState(false);
  const [pocketType, setPocketType] = useState<"flexible" | "term">("flexible");

  const activeChild = children.find((c) => c.id === activeChildId);
  const pockets = pocketsByProfile[activeChildId] ?? [];
  const savable = savableByProfile[activeChildId] ?? 0;

  const handleCreatePocket = (formData: FormData) => {
    formData.set("profileId", activeChildId);
    formData.set("pocketType", pocketType);
    const interestPct = Number(formData.get("monthlyInterestPercent") ?? 0);
    if (Number.isFinite(interestPct)) {
      formData.set("monthlyInterestBps", String(Math.round(interestPct * 100)));
    }
    formData.delete("monthlyInterestPercent");
    startTransition(async () => {
      const res = await createSavingsPocketAction(formData);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Kantong tabungan dibuat.");
        setCreatePocketOpen(false);
        setPocketType("flexible");
        router.refresh();
      }
    });
  };

  const handleApproveWithdraw = (txId: string) => {
    startTransition(async () => {
      const res = await approveSavingsWithdrawAction(txId);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Penarikan disetujui.");
        router.refresh();
      }
    });
  };

  const handleRejectWithdraw = () => {
    if (!rejectWithdrawId) return;
    startTransition(async () => {
      const res = await rejectSavingsWithdrawAction(rejectWithdrawId, rejectReason);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Penarikan ditolak.");
        setRejectWithdrawId(null);
        setRejectReason("");
        router.refresh();
      }
    });
  };

  const handleApproveClaim = (requestId: string) => {
    startTransition(async () => {
      const res = await approveGoalClaimAction(requestId);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Hadiah disetujui untuk dicairkan.");
        router.refresh();
      }
    });
  };

  const handleRejectClaim = () => {
    if (!rejectClaimId) return;
    startTransition(async () => {
      const res = await rejectGoalClaimAction(rejectClaimId, rejectReason);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Permintaan hadiah ditolak.");
        setRejectClaimId(null);
        setRejectReason("");
        router.refresh();
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
    <div className="space-y-6 pb-12">
      {pendingGoalClaims.length > 0 ? (
        <Card className="border-violet-200 bg-violet-50/80">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-base">
              Cair hadiah menunggu ({pendingGoalClaims.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingGoalClaims.map((c) => (
              <div
                key={c.id}
                className="flex flex-col gap-2 rounded-xl border border-violet-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold">
                    <Gift className="mr-1 inline size-4 text-violet-600" aria-hidden />
                    {c.child_name} · {c.goal_title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ingin mencairkan hadiah ({c.amount} energi)
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={isPending} onClick={() => handleApproveClaim(c.id)} className="gap-1">
                    <Check className="size-4" aria-hidden />
                    Setujui
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => setRejectClaimId(c.id)}
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

      {pendingWithdrawals.length > 0 ? (
        <Card className="border-amber-200 bg-amber-50/80">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-base">
              Penarikan menunggu ({pendingWithdrawals.length})
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
                  <Button size="sm" disabled={isPending} onClick={() => handleApproveWithdraw(w.id)} className="gap-1">
                    <Check className="size-4" aria-hidden />
                    Setujui
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => setRejectWithdrawId(w.id)}
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

      <ChildTabSelector
        profiles={children}
        activeChildId={activeChildId}
        onActiveChildIdChange={setActiveChildId}
      />

      {activeChild ? (
        <div className="rounded-xl border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Energi di target aktif</p>
          <p className="font-heading text-xl font-bold text-emerald-700">{savable} ⚡</p>
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
                ? Math.min(100, Math.round((pocket.balance / pocket.target_amount) * 100))
                : null;
            const effectiveBps = effectiveMonthlyBps(pocket);

            return (
              <Card key={pocket.id} className="overflow-hidden">
                <div className="h-1" style={{ backgroundColor: pocket.accent_color }} aria-hidden />
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="font-heading text-lg font-semibold">
                          {pocket.emoji} {pocket.name}
                        </p>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                            pocket.pocket_type === "term"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-600",
                          )}
                        >
                          {pocket.pocket_type === "term" ? "Deposito" : "Akumulatif"}
                        </span>
                        {pocket.default_for_goal_save ? (
                          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                            Default tabung target
                          </span>
                        ) : null}
                      </div>
                      <p className="text-2xl font-bold text-violet-700">{pocket.balance} ⚡</p>
                      {pocket.monthly_interest_bps > 0 ? (
                        <p className="text-xs text-emerald-700">
                          Bunga {formatInterestBps(effectiveBps)}/bulan
                          {pocket.projected_interest > 0
                            ? ` · proyeksi +${pocket.projected_interest} ⚡`
                            : ""}
                        </p>
                      ) : null}
                      {pocket.is_locked && pocket.locked_until ? (
                        <p className="flex items-center gap-1 text-xs text-amber-700">
                          <Lock className="size-3" aria-hidden />
                          Terkunci hingga{" "}
                          {new Date(pocket.locked_until).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      ) : null}
                      {pocket.reserved > 0 ? (
                        <p className="text-xs text-amber-700">{pocket.reserved} menunggu penarikan</p>
                      ) : null}
                    </div>
                    {pocket.target_amount ? (
                      <span className="shrink-0 text-xs text-muted-foreground">
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

      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom)+0.625rem)] z-50">
        <div className="pointer-events-auto mx-auto flex max-w-lg items-center justify-center gap-2 px-4">
          <Link
            href="/parent/ledger"
            data-compact
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 shadow-lg shadow-slate-950/10 ring-1 ring-slate-200/50 transition-colors hover:bg-slate-50"
          >
            <BookOpen className="h-4 w-4" aria-hidden />
            Buku besar
          </Link>
          {activeChild ? (
            <button
              type="button"
              data-compact
              onClick={() => setCreatePocketOpen(true)}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-violet-700 px-4 text-xs font-bold text-white shadow-lg shadow-violet-950/25 ring-1 ring-violet-600/20 transition-colors hover:bg-violet-800"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Kantong baru
            </button>
          ) : null}
        </div>
      </div>

      <Dialog open={createPocketOpen} onOpenChange={setCreatePocketOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kantong untuk {activeChild?.name}</DialogTitle>
            <DialogDescription>
              Atur tipe kantong, bunga, dan kunci. Deposito hanya menerima satu setoran.
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
              <Input id="pocket-name" name="name" required maxLength={40} placeholder="Mis. Tabungan sepeda" />
            </div>

            <div className="space-y-2">
              <Label>Tipe kantong</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPocketType("flexible")}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                    pocketType === "flexible"
                      ? "border-violet-500 bg-violet-50 font-semibold"
                      : "border-border hover:bg-muted/50",
                  )}
                >
                  <span className="block font-bold">Akumulatif</span>
                  <span className="text-muted-foreground">Banyak setoran</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPocketType("term")}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                    pocketType === "term"
                      ? "border-amber-500 bg-amber-50 font-semibold"
                      : "border-border hover:bg-muted/50",
                  )}
                >
                  <span className="block font-bold">Deposito</span>
                  <span className="text-muted-foreground">Satu setoran + kunci</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="pocket-emoji">Emoji</Label>
                <Input id="pocket-emoji" name="emoji" defaultValue="🐷" maxLength={8} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pocket-target">Target (opsional)</Label>
                <Input id="pocket-target" name="targetAmount" type="number" min={1} placeholder="100" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="monthly-interest">Bunga (%/bulan)</Label>
                <Input
                  id="monthly-interest"
                  name="monthlyInterestPercent"
                  type="number"
                  min={0}
                  max={maxMonthlyInterestBps / 100}
                  step={0.1}
                  defaultValue={0}
                />
              </div>
              {pocketType === "term" ? (
                <div className="space-y-2">
                  <Label htmlFor="lock-months">Kunci (bulan)</Label>
                  <Input id="lock-months" name="lockMonths" type="number" min={1} max={36} defaultValue={3} required />
                </div>
              ) : null}
            </div>

            {pocketType === "term" ? (
              <div className="space-y-2">
                <Label htmlFor="lock-coefficient">Koefisien bonus kunci</Label>
                <Input
                  id="lock-coefficient"
                  name="lockBonusCoefficient"
                  type="number"
                  min={0.1}
                  max={5}
                  step={0.1}
                  defaultValue={1}
                />
                <p className="text-[10px] text-muted-foreground">
                  Semakin tinggi, bunga efektif lebih besar selama masa kunci.
                </p>
              </div>
            ) : (
              <input type="hidden" name="lockBonusCoefficient" value="1" />
            )}

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="defaultForGoalSave" className="rounded border-input" />
              Kantong default saat anak menabung dari target hadiah
            </label>

            <input type="hidden" name="accentColor" value="#8B5CF6" />
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                Buat kantong
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectWithdrawId} onOpenChange={(o) => !o && setRejectWithdrawId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tolak penarikan</DialogTitle>
            <DialogDescription>Beri alasan singkat agar anak mengerti (opsional).</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-withdraw-reason">Alasan</Label>
            <Input
              id="reject-withdraw-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Mis. nabung dulu sampai kunci habis"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectWithdrawId(null)}>Batal</Button>
            <Button variant="destructive" disabled={isPending} onClick={handleRejectWithdraw}>
              Tolak penarikan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectClaimId} onOpenChange={(o) => !o && setRejectClaimId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tolak cair hadiah</DialogTitle>
            <DialogDescription>
              Anak masih bisa memilih menabung energinya ke kantong.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-claim-reason">Alasan</Label>
            <Input
              id="reject-claim-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Mis. nabung dulu untuk hadiah yang lebih besar"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectClaimId(null)}>Batal</Button>
            <Button variant="destructive" disabled={isPending} onClick={handleRejectClaim}>
              Tolak permintaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
