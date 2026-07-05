"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  PiggyBank,
  ArrowDownToLine,
  ArrowUpFromLine,
  Lock,
  Zap,
  Sparkles,
  TrendingUp,
  Wallet,
  Vault,
} from "lucide-react";
import { formatInterestBps, effectiveMonthlyBps } from "@/lib/savings/interest";
import { useChildModeStore } from "@/lib/stores/child-mode-store";
import {
  useChildSavingsData,
  useInvalidateChildSavings,
} from "@/lib/hooks/use-child-savings-data";
import { useInvalidateChildTargets } from "@/lib/hooks/use-child-targets-data";
import {
  depositToSavingsAction,
  requestSavingsWithdrawAction,
} from "@/app/child/savings/actions";
import type { SavingsPocketWithBalance } from "@/lib/savings/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageLoadingSkeleton } from "@/components/shared/page-loading-skeleton";
import { ChildFetchingIndicator } from "@/components/shared/child-fetching-indicator";
import { ChildGoldSavingsSection } from "@/components/child/child-gold-savings-section";
import { cn } from "@/lib/utils";

function formatLockDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function pocketAccent(pocket: SavingsPocketWithBalance) {
  return pocket.pocket_type === "term"
    ? "from-amber-500 via-orange-500 to-amber-600"
    : "from-violet-600 via-indigo-500 to-violet-600";
}

export function ChildSavingsView() {
  const profileId = useChildModeStore((s) => s.profileId);
  const profileName = useChildModeStore((s) => s.profileName);
  const { data, isLoading, isFetching } = useChildSavingsData(profileId);
  const invalidateSavings = useInvalidateChildSavings(profileId ?? "");
  const invalidateTargets = useInvalidateChildTargets(profileId ?? "");
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [depositFeedback, setDepositFeedback] = useState<string | null>(null);
  const [activePocketId, setActivePocketId] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState("5");
  const [withdrawAmount, setWithdrawAmount] = useState("5");
  const [withdrawNote, setWithdrawNote] = useState("");

  const effectivePocketId = activePocketId ?? data?.pockets[0]?.id ?? null;

  useEffect(() => {
    if (data?.pockets.length && activePocketId === null) {
      setActivePocketId(data.pockets[0].id);
    }
  }, [data?.pockets, activePocketId]);

  const handleDeposit = () => {
    setDepositFeedback(null);
    const pocketId = effectivePocketId;
    if (!pocketId) {
      const message = "Pilih kantong tabungan dulu.";
      setDepositFeedback(message);
      toast.error(message);
      return;
    }
    const amount = Number(depositAmount);
    if (!Number.isFinite(amount) || amount < 1) {
      const message = "Masukkan jumlah energi minimal 1.";
      setDepositFeedback(message);
      toast.error(message);
      return;
    }
    const savableBalance = data?.savableBalance ?? 0;
    const walletBalance = data?.walletBalance ?? 0;
    const maxDeposit = Math.min(savableBalance, walletBalance);
    if (amount > maxDeposit) {
      const message =
        walletBalance < savableBalance
          ? `Maksimal ${walletBalance} energi (saldo dompet).`
          : `Maksimal ${savableBalance} energi dari target aktif.`;
      setDepositFeedback(message);
      toast.error(message);
      return;
    }
    setIsSubmitting(true);
    startTransition(async () => {
      try {
        const res = await depositToSavingsAction(pocketId, amount);
        if (res.error) {
          setDepositFeedback(res.error);
          toast.error(res.error);
        } else {
          setDepositFeedback("Berhasil menabung!");
          toast.success("Berhasil menabung!");
          invalidateSavings();
          invalidateTargets();
        }
      } catch {
        const message = "Gagal menabung. Periksa koneksi lalu coba lagi.";
        setDepositFeedback(message);
        toast.error(message);
      } finally {
        setIsSubmitting(false);
      }
    });
  };

  const handleWithdraw = () => {
    if (!effectivePocketId) return;
    const amount = Number(withdrawAmount);
    if (!Number.isFinite(amount) || amount < 1) {
      toast.error("Masukkan jumlah energi minimal 1.");
      return;
    }
    startTransition(async () => {
      const res = await requestSavingsWithdrawAction(
        effectivePocketId,
        amount,
        withdrawNote,
      );
      if (res.error) toast.error(res.error);
      else {
        toast.success("Permintaan penarikan dikirim ke ortu.");
        setWithdrawNote("");
        invalidateSavings();
      }
    });
  };

  if (!profileId) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Pilih profil anak dari Mode Anak terlebih dahulu.
      </p>
    );
  }

  if (isLoading && !data) {
    return <PageLoadingSkeleton variant="child" className="min-h-[50vh]" />;
  }

  if (!data) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <span className="text-4xl" aria-hidden>
          😅
        </span>
        <p className="text-sm font-bold text-emerald-800">Gagal memuat tabungan.</p>
        <p className="text-xs text-emerald-600">Coba refresh halaman ya!</p>
      </div>
    );
  }

  if (!data.savingsEnabled && !data.gold.goldSavingsEnabled) {
    return (
      <div className="space-y-6">
        <Card className="overflow-hidden border-violet-100 bg-white/80">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="rounded-2xl bg-violet-50 p-4">
              <PiggyBank className="size-10 text-violet-400" aria-hidden />
            </div>
            <div>
              <p className="font-heading text-sm font-bold text-slate-900">
                Tabungan belum aktif
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Minta Papa/Mama mengaktifkannya di Pengaturan → Fitur Engagement.
              </p>
            </div>
          </CardContent>
        </Card>
        <ChildGoldSavingsSection
          profileId={profileId}
          gold={data.gold}
          savableBalance={data.savableBalance}
          walletBalance={data.walletBalance}
          onSuccess={invalidateSavings}
        />
      </div>
    );
  }

  const savingsDisabledCard = !data.savingsEnabled ? (
    <Card className="overflow-hidden border-violet-100 bg-white/80">
      <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
        <div className="rounded-2xl bg-violet-50 p-4">
          <PiggyBank className="size-10 text-violet-400" aria-hidden />
        </div>
        <div>
          <p className="font-heading text-sm font-bold text-slate-900">Tabungan belum aktif</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Kantong tabungan dinonaktifkan, tapi Tabung Emas masih bisa dipakai di bawah.
          </p>
        </div>
      </CardContent>
    </Card>
  ) : null;

  if (!data.savingsEnabled) {
    return (
      <div className="relative space-y-6 pb-4" data-fetching={isFetching ? "" : undefined}>
        <ChildFetchingIndicator isFetching={isFetching && !!data} />
        {savingsDisabledCard}
        <ChildGoldSavingsSection
          profileId={profileId}
          gold={data.gold}
          savableBalance={data.savableBalance}
          walletBalance={data.walletBalance}
          onSuccess={invalidateSavings}
        />
      </div>
    );
  }

  const activePocket = data.pockets.find((p) => p.id === activePocketId) ?? data.pockets[0];
  const availableInPocket = activePocket ? activePocket.balance - activePocket.reserved : 0;
  const termPocketFull =
    activePocket?.pocket_type === "term" && (activePocket?.balance ?? 0) > 0;
  const savable = data.savableBalance;
  const wallet = data.walletBalance;
  const maxDepositable = Math.min(savable, wallet);
  const canDeposit = activePocket && !termPocketFull && maxDepositable > 0;
  const canWithdraw = activePocket && !activePocket.is_locked && availableInPocket > 0;
  const targetProgress =
    activePocket?.target_amount && activePocket.target_amount > 0
      ? Math.min(100, Math.round((activePocket.balance / activePocket.target_amount) * 100))
      : null;

  const setQuickDeposit = (fraction: number) => {
    const amount = Math.max(1, Math.floor(maxDepositable * fraction));
    setDepositAmount(String(amount));
    setDepositFeedback(null);
  };

  return (
    <div className="relative space-y-6 pb-4" data-fetching={isFetching ? "" : undefined}>
      <ChildFetchingIndicator isFetching={isFetching && !!data} />

      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-bold tracking-tight text-slate-900">
            Tabunganku {profileName ? `· ${profileName}` : ""} 🐷
          </h2>
          <p className="mt-1 text-xs text-muted-foreground text-pretty">
            Pindahkan energi dari target aktif ke kantong tabunganmu.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white p-3.5 shadow-sm">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
            <TrendingUp className="size-3.5" aria-hidden />
            Bisa ditabung
          </div>
          <p className="mt-1 font-heading text-2xl font-black text-emerald-800 tabular-nums">
            {savable}
            <span className="ml-0.5 text-base">⚡</span>
          </p>
          <p className="mt-0.5 text-[10px] text-emerald-700/80">Dari target aktif</p>
        </div>
        <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-white p-3.5 shadow-sm">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
            <Wallet className="size-3.5" aria-hidden />
            Dompet
          </div>
          <p className="mt-1 font-heading text-2xl font-black text-amber-950 tabular-nums">
            {wallet}
            <span className="ml-0.5 text-base">⚡</span>
          </p>
          <p className="mt-0.5 text-[10px] text-amber-800/80">
            {wallet < savable ? "Batas setoran sekarang" : "Siap ditabung"}
          </p>
        </div>
      </div>

      {data.pockets.length === 0 ? (
        <Card className="overflow-hidden border-dashed border-violet-200 bg-white/60">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="rounded-2xl bg-violet-50 p-4">
              <PiggyBank className="size-10 text-violet-400" aria-hidden />
            </div>
            <div>
              <p className="font-heading text-sm font-bold text-slate-900">
                Belum ada kantong
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Minta Papa/Mama membuatkan kantong tabungan dulu.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-2">
            <h3 className="px-1 text-xs font-bold uppercase tracking-wider text-slate-400">
              Pilih kantong
            </h3>
            <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory">
              {data.pockets.map((pocket) => {
                const selected = pocket.id === (activePocket?.id ?? "");
                const isTerm = pocket.pocket_type === "term";
                return (
                  <button
                    key={pocket.id}
                    type="button"
                    onClick={() => setActivePocketId(pocket.id)}
                    className={cn(
                      "min-w-[9.5rem] shrink-0 snap-start rounded-2xl border p-3 text-left transition-all",
                      selected
                        ? isTerm
                          ? "border-amber-400 bg-amber-50 shadow-md ring-2 ring-amber-400/30"
                          : "border-violet-400 bg-violet-50 shadow-md ring-2 ring-violet-400/30"
                        : "border-slate-200/80 bg-white hover:border-slate-300",
                    )}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-xl leading-none" aria-hidden>
                        {pocket.emoji}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "h-5 px-1.5 text-[9px] font-bold uppercase",
                          isTerm
                            ? "border-amber-300 bg-amber-100 text-amber-800"
                            : "border-violet-200 bg-violet-100 text-violet-800",
                        )}
                      >
                        {isTerm ? "Deposito" : "Flex"}
                      </Badge>
                    </div>
                    <p className="mt-2 truncate text-xs font-bold text-slate-900">
                      {pocket.name}
                    </p>
                    <p className="mt-0.5 text-sm font-black text-slate-700 tabular-nums">
                      {pocket.balance} ⚡
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {activePocket ? (
            <motion.div
              key={activePocket.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <Card
                className={cn(
                  "overflow-hidden border-0 text-white shadow-lg",
                  "bg-gradient-to-br",
                  pocketAccent(activePocket),
                )}
              >
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-white/80">Saldo kantong</p>
                      <p className="font-heading text-3xl font-black tracking-tight tabular-nums">
                        {activePocket.balance}
                        <span className="ml-1 text-lg">⚡</span>
                      </p>
                    </div>
                    <span className="text-3xl leading-none" aria-hidden>
                      {activePocket.emoji}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold text-white/90">
                      <span>{activePocket.name}</span>
                      <span>
                        {activePocket.pocket_type === "term" ? (
                          <span className="inline-flex items-center gap-1">
                            <Vault className="size-3" aria-hidden />
                            Deposito
                          </span>
                        ) : (
                          "Akumulatif"
                        )}
                      </span>
                    </div>
                    {targetProgress !== null ? (
                      <div className="mt-2.5 space-y-1">
                        <div className="h-2 overflow-hidden rounded-full bg-white/25">
                          <div
                            className="h-full rounded-full bg-white transition-all duration-500"
                            style={{ width: `${targetProgress}%` }}
                          />
                        </div>
                        <p className="text-[10px] font-medium text-white/85">
                          Target {activePocket.target_amount} ⚡ · {targetProgress}%
                        </p>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {activePocket.monthly_interest_bps > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-bold backdrop-blur-sm">
                        <Sparkles className="size-3" aria-hidden />
                        Bunga {formatInterestBps(effectiveMonthlyBps(activePocket))}/bln
                      </span>
                    ) : null}
                    {activePocket.projected_interest > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-bold backdrop-blur-sm">
                        +{activePocket.projected_interest} ⚡ perkiraan
                      </span>
                    ) : null}
                    {activePocket.interest_accrued > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-bold backdrop-blur-sm">
                        +{activePocket.interest_accrued} ⚡ bunga masuk
                      </span>
                    ) : null}
                    {activePocket.is_locked && activePocket.locked_until ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-black/20 px-2.5 py-1 text-[10px] font-bold backdrop-blur-sm">
                        <Lock className="size-3" aria-hidden />
                        Kunci sampai {formatLockDate(activePocket.locked_until)}
                      </span>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              {activePocket.reserved > 0 ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-center text-xs font-medium text-amber-900">
                  {activePocket.reserved} ⚡ menunggu persetujuan ortu untuk ditarik.
                </p>
              ) : null}

              {canDeposit ? (
                <Card className="overflow-hidden border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white shadow-sm">
                  <CardContent className="space-y-4 p-4">
                    <div className="flex items-center gap-2">
                      <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                        <ArrowDownToLine className="size-4" aria-hidden />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-emerald-900">Nabung ke kantong</p>
                        <p className="text-[10px] text-emerald-700">
                          Maks. {maxDepositable} ⚡ bisa disetor sekarang
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: "25%", fraction: 0.25 },
                        { label: "50%", fraction: 0.5 },
                        { label: "Semua", fraction: 1 },
                      ].map((chip) => (
                        <button
                          key={chip.label}
                          type="button"
                          onClick={() => setQuickDeposit(chip.fraction)}
                          className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-100"
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Zap
                          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-amber-500"
                          aria-hidden
                        />
                        <Input
                          type="number"
                          min={1}
                          max={maxDepositable}
                          value={depositAmount}
                          onChange={(e) => {
                            setDepositAmount(e.target.value);
                            setDepositFeedback(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleDeposit();
                            }
                          }}
                          className="h-11 pl-9 text-base font-bold tabular-nums"
                          aria-label="Jumlah nabung"
                        />
                      </div>
                      <Button
                        type="button"
                        disabled={isPending || isSubmitting}
                        onClick={handleDeposit}
                        className="h-11 shrink-0 rounded-xl bg-emerald-600 px-5 font-bold hover:bg-emerald-700"
                      >
                        {isPending || isSubmitting ? "…" : "Nabung"}
                      </Button>
                    </div>
                    {depositFeedback ? (
                      <p
                        role="status"
                        className={cn(
                          "text-xs font-semibold",
                          depositFeedback.startsWith("Berhasil")
                            ? "text-emerald-700"
                            : "text-destructive",
                        )}
                      >
                        {depositFeedback}
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              ) : termPocketFull ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center">
                  <p className="text-xs font-bold text-amber-900">Deposito sudah terisi</p>
                  <p className="mt-1 text-[10px] text-amber-800 text-pretty">
                    Kantong ini hanya menerima satu setoran. Minta ortu buat kantong deposito baru
                    kalau mau menabung lagi.
                  </p>
                </div>
              ) : savable > 0 && wallet < 1 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center">
                  <p className="text-xs font-bold text-amber-900">Dompet masih kosong</p>
                  <p className="mt-1 text-[10px] text-amber-800 text-pretty">
                    Ada {savable} ⚡ di target, tapi belum masuk dompet. Selesaikan misi dulu ya!
                  </p>
                </div>
              ) : savable < 1 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-3 text-center">
                  <p className="text-xs font-medium text-slate-600">
                    Belum ada energi di target aktif untuk ditabung.
                  </p>
                </div>
              ) : null}

              <Card className="border-violet-100 bg-white/80 shadow-sm">
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-xl border border-violet-200 bg-violet-50 text-violet-700">
                      <ArrowUpFromLine className="size-4" aria-hidden />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-violet-950">Tarik energi</p>
                      <p className="text-[10px] text-muted-foreground">
                        Butuh persetujuan ortu · tersedia {availableInPocket} ⚡
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="withdraw-amount" className="text-xs font-bold text-slate-700">
                      Jumlah tarik
                    </Label>
                    <Input
                      id="withdraw-amount"
                      type="number"
                      min={1}
                      max={availableInPocket}
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      className="h-10 tabular-nums"
                      disabled={!canWithdraw}
                    />
                    <Input
                      placeholder="Catatan untuk ortu (opsional)"
                      value={withdrawNote}
                      onChange={(e) => setWithdrawNote(e.target.value)}
                      maxLength={200}
                      className="h-10"
                      disabled={!canWithdraw}
                    />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full rounded-xl border-violet-200 font-bold text-violet-900 hover:bg-violet-50"
                    disabled={isPending || isSubmitting || !canWithdraw}
                    onClick={handleWithdraw}
                  >
                    {activePocket.is_locked ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Lock className="size-4" aria-hidden />
                        Masih terkunci
                      </span>
                    ) : (
                      "Ajukan penarikan"
                    )}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ) : null}
        </>
      )}

      <ChildGoldSavingsSection
        profileId={profileId}
        gold={data.gold}
        savableBalance={data.savableBalance}
        walletBalance={data.walletBalance}
        onSuccess={invalidateSavings}
      />
    </div>
  );
}
