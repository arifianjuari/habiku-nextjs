"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { PiggyBank, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { useChildModeStore } from "@/lib/stores/child-mode-store";
import {
  useChildSavingsData,
  useInvalidateChildSavings,
} from "@/lib/hooks/use-child-savings-data";
import {
  depositToSavingsAction,
  requestSavingsWithdrawAction,
} from "@/app/child/savings/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoadingSkeleton } from "@/components/shared/page-loading-skeleton";
import { ChildFetchingIndicator } from "@/components/shared/child-fetching-indicator";

export function ChildSavingsView() {
  const profileId = useChildModeStore((s) => s.profileId);
  const profileName = useChildModeStore((s) => s.profileName);
  const { data, isLoading, isFetching } = useChildSavingsData(profileId);
  const invalidateSavings = useInvalidateChildSavings(profileId ?? "");
  const [isPending, startTransition] = useTransition();
  const [activePocketId, setActivePocketId] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState("5");
  const [withdrawAmount, setWithdrawAmount] = useState("5");
  const [withdrawNote, setWithdrawNote] = useState("");

  const handleDeposit = () => {
    if (!activePocketId) return;
    const amount = Number(depositAmount);
    if (!Number.isFinite(amount) || amount < 1) {
      toast.error("Masukkan jumlah energi minimal 1.");
      return;
    }
    startTransition(async () => {
      const res = await depositToSavingsAction(activePocketId, amount);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Berhasil menabung!");
        invalidateSavings();
      }
    });
  };

  const handleWithdraw = () => {
    if (!activePocketId) return;
    const amount = Number(withdrawAmount);
    if (!Number.isFinite(amount) || amount < 1) {
      toast.error("Masukkan jumlah energi minimal 1.");
      return;
    }
    startTransition(async () => {
      const res = await requestSavingsWithdrawAction(
        activePocketId,
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
      <p className="text-center text-sm text-muted-foreground">
        Gagal memuat tabungan. Coba refresh halaman.
      </p>
    );
  }

  if (!data.savingsEnabled) {
    return (
      <Card className="border-violet-100 bg-white/80">
        <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
          <PiggyBank className="size-10 text-violet-300" aria-hidden />
          <p className="text-sm text-muted-foreground">
            Tabungan digital belum diaktifkan untuk keluargamu.
          </p>
          <p className="text-xs text-muted-foreground">
            Minta Papa/Mama mengaktifkannya di Pengaturan → Fitur Engagement.
          </p>
        </CardContent>
      </Card>
    );
  }

  const activePocket = data.pockets.find((p) => p.id === activePocketId) ?? data.pockets[0];
  const availableInPocket = activePocket
    ? activePocket.balance - activePocket.reserved
    : 0;

  return (
    <div className="relative space-y-5 pb-4" data-fetching={isFetching ? "" : undefined}>
      <ChildFetchingIndicator isFetching={isFetching && !!data} />

      <div className="rounded-2xl border border-emerald-200 bg-white/90 p-4 shadow-sm">
        <p className="text-xs font-medium text-emerald-700">Dompet {profileName}</p>
        <p className="font-heading text-3xl font-bold text-emerald-800">
          {data.walletBalance} ⚡
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Energi yang bisa ditabung ke kantong
        </p>
      </div>

      {data.pockets.length === 0 ? (
        <Card className="border-violet-100">
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <PiggyBank className="size-10 text-violet-400" aria-hidden />
            <p className="text-sm text-muted-foreground">
              Belum ada kantong tabungan. Minta Papa/Mama membuatkan kantong dulu.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {data.pockets.map((pocket) => {
              const selected = pocket.id === (activePocket?.id ?? "");
              return (
                <button
                  key={pocket.id}
                  type="button"
                  onClick={() => setActivePocketId(pocket.id)}
                  className={
                    selected
                      ? "shrink-0 rounded-full bg-violet-600 px-3 py-1.5 text-sm font-medium text-white"
                      : "shrink-0 rounded-full border border-violet-200 bg-white px-3 py-1.5 text-sm"
                  }
                >
                  {pocket.emoji} {pocket.name}
                </button>
              );
            })}
          </div>

          {activePocket ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <Card className="overflow-hidden border-violet-200">
                <div
                  className="h-1.5"
                  style={{ backgroundColor: activePocket.accent_color }}
                  aria-hidden
                />
                <CardContent className="pt-4">
                  <p className="font-heading text-lg font-semibold">
                    {activePocket.emoji} {activePocket.name}
                  </p>
                  <p className="text-2xl font-bold text-violet-700">
                    {activePocket.balance} ⚡
                  </p>
                  {activePocket.target_amount ? (
                    <p className="text-xs text-muted-foreground">
                      Target {activePocket.target_amount} ·{" "}
                      {Math.min(
                        100,
                        Math.round(
                          (activePocket.balance / activePocket.target_amount) * 100,
                        ),
                      )}
                      %
                    </p>
                  ) : null}
                  {activePocket.reserved > 0 ? (
                    <p className="text-xs text-amber-700">
                      {activePocket.reserved} energi menunggu persetujuan ortu
                    </p>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="border-emerald-100 bg-emerald-50/50">
                <CardContent className="space-y-3 pt-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                    <ArrowDownToLine className="size-4" aria-hidden />
                    Nabung ke kantong
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      aria-label="Jumlah nabung"
                    />
                    <Button disabled={isPending} onClick={handleDeposit}>
                      Nabung
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-violet-100 bg-violet-50/40">
                <CardContent className="space-y-3 pt-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-violet-900">
                    <ArrowUpFromLine className="size-4" aria-hidden />
                    Tarik ke dompet (butuh OK ortu)
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Tersedia ditarik: {availableInPocket} ⚡
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="withdraw-amount" className="sr-only">
                      Jumlah tarik
                    </Label>
                    <Input
                      id="withdraw-amount"
                      type="number"
                      min={1}
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                    />
                    <Input
                      placeholder="Catatan untuk ortu (opsional)"
                      value={withdrawNote}
                      onChange={(e) => setWithdrawNote(e.target.value)}
                      maxLength={200}
                    />
                  </div>
                  <Button
                    variant="outline"
                    className="w-full border-violet-300"
                    disabled={isPending || availableInPocket < 1}
                    onClick={handleWithdraw}
                  >
                    Ajukan penarikan
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ) : null}
        </>
      )}
    </div>
  );
}
