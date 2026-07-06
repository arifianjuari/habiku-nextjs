"use client";



import { useMemo, useState, useTransition } from "react";

import { toast } from "sonner";

import { ArrowDownToLine, ArrowUpFromLine, Clock, Coins, Zap } from "lucide-react";

import type { ChildGoldSavingsData } from "@/lib/gold/types";

import {

  formatGoldQuantity,

  maxBuyMilliFromEnergy,

  milliFromBuyEnergy,

  milliToDisplayQuantity,

  parseQuantityInputToMilli,

  energyForSellMilli,

} from "@/lib/gold/units";

import { requestGoldBuyAction, requestGoldSellAction } from "@/app/child/savings/actions";
import { ChildGoldPnlPanel } from "@/components/child/child-gold-pnl-panel";

import { Card, CardContent } from "@/components/ui/card";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";

import { cn } from "@/lib/utils";



type ChildGoldSavingsSectionProps = {

  profileId: string;

  gold: ChildGoldSavingsData;

  savableBalance: number;

  walletBalance: number;

  onSuccess: () => void;

};



function formatTxDate(iso: string): string {

  return new Date(iso).toLocaleDateString("id-ID", {

    day: "numeric",

    month: "short",

    hour: "2-digit",

    minute: "2-digit",

  });

}



function txStatusLabel(status: ChildGoldSavingsData["transactions"][number]["status"]): string {

  if (status === "pending") return "Menunggu ortu";

  if (status === "rejected") return "Ditolak";

  return "";

}



export function ChildGoldSavingsSection({

  profileId,

  gold,

  savableBalance,

  walletBalance,

  onSuccess,

}: ChildGoldSavingsSectionProps) {

  const [isPending, startTransition] = useTransition();

  const spendableEnergy = Math.max(

    Math.min(savableBalance, walletBalance) - gold.pendingBuyEnergy,

    0,

  );

  const availableMilli = Math.max(gold.quantityMilli - gold.reservedSellMilli, 0);

  const [buyEnergy, setBuyEnergy] = useState(String(Math.max(0, spendableEnergy)));

  const [sellQuantity, setSellQuantity] = useState("0,5");



  const unitLabel = gold.prices.unitLabel;

  const sellPrice = gold.prices.sellPriceEnergy;

  const buyPrice = gold.prices.buyPriceEnergy;



  const buyEnergyNum = Number(buyEnergy);

  const buyMilliPreview = useMemo(() => {

    if (!Number.isFinite(buyEnergyNum) || buyEnergyNum < 1) return 0;

    return milliFromBuyEnergy(buyEnergyNum, sellPrice);

  }, [buyEnergyNum, sellPrice]);



  const sellMilli = useMemo(

    () => parseQuantityInputToMilli(sellQuantity),

    [sellQuantity],

  );

  const sellEnergyGain = useMemo(() => {

    if (sellMilli === null) return 0;

    return energyForSellMilli(sellMilli, buyPrice);

  }, [sellMilli, buyPrice]);



  const maxBuyMilli = maxBuyMilliFromEnergy(spendableEnergy, sellPrice);

  const minBuyEnergy = sellPrice > 0 ? Math.ceil(sellPrice / 1000) : 1;



  const handleBuy = () => {

    const energy = Number(buyEnergy);

    if (!Number.isFinite(energy) || energy < 1) {

      toast.error("Masukkan jumlah energi minimal 1.");

      return;

    }

    if (energy > spendableEnergy) {

      toast.error(`Maksimal ${spendableEnergy} energi saat ini.`);

      return;

    }

    const milli = milliFromBuyEnergy(energy, sellPrice);

    if (milli < 1) {

      toast.error(

        `Energi terlalu sedikit. Butuh minimal ${minBuyEnergy} E untuk pecahan emas terkecil.`,

      );

      return;

    }



    startTransition(async () => {

      const res = await requestGoldBuyAction(profileId, energy);

      if (res.error) toast.error(res.error);

      else {

        toast.success(

          `Permintaan beli ${formatGoldQuantity(milli, unitLabel)} emas dikirim — tunggu persetujuan Papa/Mama.`,

        );

        onSuccess();

      }

    });

  };



  const handleSell = () => {

    if (sellMilli === null) {

      toast.error("Masukkan jumlah emas yang valid (mis. 0,5).");

      return;

    }

    if (sellMilli > availableMilli) {

      toast.error(

        `Tersedia ${formatGoldQuantity(availableMilli, unitLabel)} emas (termasuk yang sudah diajukan jual).`,

      );

      return;

    }

    if (sellEnergyGain < 1) {

      toast.error("Jumlah emas terlalu kecil untuk dijual.");

      return;

    }



    startTransition(async () => {

      const res = await requestGoldSellAction(profileId, sellMilli);

      if (res.error) toast.error(res.error);

      else {

        toast.success(

          `Permintaan jual ${formatGoldQuantity(sellMilli, unitLabel)} dikirim — tunggu persetujuan Papa/Mama.`,

        );

        onSuccess();

      }

    });

  };



  if (!gold.goldSavingsEnabled) {

    return (

      <section className="space-y-2" aria-label="Tabung Emas">

        <h3 className="px-1 text-xs font-bold uppercase tracking-wider text-slate-400">

          Tabung Emas

        </h3>

        <Card className="overflow-hidden border-amber-100 bg-white/80">

          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">

            <div className="rounded-2xl bg-amber-50 p-4 text-3xl" aria-hidden>

              🪙

            </div>

            <div>

              <p className="font-heading text-sm font-bold text-slate-900">Tabung Emas belum aktif</p>

              <p className="mt-1 text-xs text-muted-foreground text-pretty">

                Minta Papa/Mama mengaktifkannya di pengaturan keluarga.

              </p>

            </div>

          </CardContent>

        </Card>

      </section>

    );

  }



  return (

    <section className="space-y-3" aria-label="Tabung Emas">

      <h3 className="px-1 text-xs font-bold uppercase tracking-wider text-amber-600/80">

        Tabung Emas 🪙

      </h3>



      {gold.pendingTrades.length > 0 ? (

        <Card className="border-amber-200/80 bg-amber-50/60 shadow-sm">

          <CardContent className="space-y-2 p-3">

            <div className="flex items-center gap-2">

              <Clock className="size-4 text-amber-700" aria-hidden />

              <p className="text-xs font-bold text-amber-950">Menunggu persetujuan ortu</p>

            </div>

            <ul className="space-y-1">

              {gold.pendingTrades.map((trade) => (

                <li

                  key={trade.id}

                  className="rounded-lg border border-amber-100 bg-white/80 px-2.5 py-1.5 text-[11px] text-amber-950"

                >

                  {trade.kind === "buy" ? "Beli" : "Jual"}{" "}

                  {formatGoldQuantity(trade.quantityMilli, unitLabel)} · {trade.energy_amount} E

                </li>

              ))}

            </ul>

          </CardContent>

        </Card>

      ) : null}



      <Card className="overflow-hidden border-amber-200/80 bg-gradient-to-br from-amber-50 via-white to-yellow-50/50 shadow-sm">

        <CardContent className="space-y-3 p-4">

          <div className="flex items-center gap-2">

            <div className="flex size-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">

              <Coins className="size-4" aria-hidden />

            </div>

            <div>

              <p className="text-sm font-bold text-amber-950">Emasku</p>

              <p className="text-[10px] text-muted-foreground">

                Beli {sellPrice} E · Jual {buyPrice} E per 1 {unitLabel} · butuh OK ortu

              </p>

            </div>

          </div>



          <div className="grid grid-cols-2 gap-2">

            <div className="rounded-xl border border-amber-100 bg-white/80 px-3 py-2">

              <p className="text-[10px] text-muted-foreground">Saldo emas</p>

              <p className="font-heading text-xl font-black tabular-nums text-amber-800">

                {milliToDisplayQuantity(gold.quantityMilli).toLocaleString("id-ID", {

                  maximumFractionDigits: 3,

                })}

                <span className="ml-1 text-xs font-bold text-muted-foreground">{unitLabel}</span>

              </p>

              {gold.reservedSellMilli > 0 ? (

                <p className="mt-0.5 text-[9px] text-amber-800/80">

                  Tersedia jual: {formatGoldQuantity(availableMilli, unitLabel)}

                </p>

              ) : null}

            </div>

            <div className="rounded-xl border border-emerald-100 bg-white/80 px-3 py-2">

              <p className="text-[10px] text-muted-foreground">Estimasi jual</p>

              <p className="font-heading text-xl font-black tabular-nums text-emerald-700">

                {gold.estimatedSellEnergy}

                <span className="ml-1 text-xs font-bold text-muted-foreground">E</span>

              </p>

            </div>

          </div>

        </CardContent>

      </Card>



      <ChildGoldPnlPanel
        profileId={profileId}
        quantityMilli={gold.quantityMilli}
        buyPriceEnergy={gold.prices.buyPriceEnergy}
        sellPriceEnergy={gold.prices.sellPriceEnergy}
        unitLabel={unitLabel}
        hasHoldings={gold.quantityMilli > 0}
        enabled={gold.goldSavingsEnabled}
      />



      <Card className="border-amber-100 bg-white/80 shadow-sm">

        <CardContent className="space-y-3 p-4">

          <div className="flex items-center gap-2">

            <div className="flex size-8 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700">

              <ArrowDownToLine className="size-4" aria-hidden />

            </div>

            <div>

              <p className="text-sm font-bold text-amber-950">Ajukan beli emas</p>

              <p className="text-[10px] text-muted-foreground">

                Maks. {formatGoldQuantity(maxBuyMilli, unitLabel)} · tersedia {spendableEnergy} E

                {gold.pendingBuyEnergy > 0 ? ` (${gold.pendingBuyEnergy} E menunggu)` : ""}

              </p>

            </div>

          </div>

          <div className="space-y-1.5">

            <Label htmlFor="gold-buy-energy" className="text-xs font-bold">

              Energi ditukar

            </Label>

            <div className="flex gap-2">

              <div className="relative min-w-0 flex-1">

                <Zap

                  className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-amber-500"

                  aria-hidden

                />

                <Input

                  id="gold-buy-energy"

                  type="number"

                  min={1}

                  max={spendableEnergy}

                  value={buyEnergy}

                  onChange={(e) => setBuyEnergy(e.target.value)}

                  className="h-11 pl-9 tabular-nums"

                  aria-label="Jumlah energi untuk beli emas"

                />

              </div>

              <Button

                type="button"

                disabled={isPending || maxBuyMilli < 1}

                onClick={handleBuy}

                className="h-11 shrink-0 rounded-xl bg-amber-600 px-5 font-bold hover:bg-amber-700"

              >

                {isPending ? "…" : "Ajukan"}

              </Button>

            </div>

            {buyMilliPreview > 0 ? (

              <p className="text-[10px] font-medium text-amber-800">

                Dapat ± {formatGoldQuantity(buyMilliPreview, unitLabel)} emas setelah disetujui

              </p>

            ) : (

              <p className="text-[10px] text-amber-800 text-pretty">

                Butuh minimal {minBuyEnergy} E untuk pecahan emas terkecil.

              </p>

            )}

          </div>

        </CardContent>

      </Card>



      <Card className="border-emerald-100 bg-white/80 shadow-sm">

        <CardContent className="space-y-3 p-4">

          <div className="flex items-center gap-2">

            <div className="flex size-8 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700">

              <ArrowUpFromLine className="size-4" aria-hidden />

            </div>

            <div>

              <p className="text-sm font-bold text-emerald-950">Ajukan jual emas</p>

              <p className="text-[10px] text-muted-foreground">

                Setelah disetujui · +{sellEnergyGain || "—"} E

              </p>

            </div>

          </div>

          <div className="space-y-1.5">

            <Label htmlFor="gold-sell-qty" className="text-xs font-bold">

              Jumlah {unitLabel} dijual

            </Label>

            <div className="flex gap-2">

              <Input

                id="gold-sell-qty"

                type="text"

                inputMode="decimal"

                placeholder="0,5"

                value={sellQuantity}

                onChange={(e) => setSellQuantity(e.target.value)}

                className="h-11 tabular-nums"

                aria-label={`Jumlah ${unitLabel} emas dijual`}

              />

              <Button

                type="button"

                disabled={isPending || availableMilli < 1}

                onClick={handleSell}

                className="h-11 shrink-0 rounded-xl bg-emerald-600 px-5 font-bold hover:bg-emerald-700"

              >

                {isPending ? "…" : "Ajukan"}

              </Button>

            </div>

          </div>

        </CardContent>

      </Card>



      {gold.transactions.length > 0 ? (

        <div className="space-y-1.5">

          <p className="px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">

            Riwayat

          </p>

          <ul className="space-y-1">

            {gold.transactions.slice(0, 6).map((tx) => {

              const statusNote = txStatusLabel(tx.status);

              return (

                <li

                  key={tx.id}

                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-white/70 px-3 py-2 text-xs"

                >

                  <div>

                    <p className="font-semibold text-slate-800">

                      {tx.kind === "buy" ? "Beli" : "Jual"}{" "}

                      {formatGoldQuantity(tx.quantityMilli, unitLabel)}

                      {statusNote ? (

                        <span className="ml-1 text-[10px] font-medium text-amber-700">

                          · {statusNote}

                        </span>

                      ) : null}

                    </p>

                    <p className="text-[10px] text-muted-foreground">{formatTxDate(tx.created_at)}</p>

                  </div>

                  <span

                    className={cn(

                      "font-bold tabular-nums",

                      tx.status === "rejected"

                        ? "text-slate-400 line-through"

                        : tx.kind === "buy"

                          ? "text-amber-700"

                          : "text-emerald-700",

                    )}

                  >

                    {tx.kind === "buy" ? "-" : "+"}

                    {tx.energy_amount} E

                  </span>

                </li>

              );

            })}

          </ul>

        </div>

      ) : null}

    </section>

  );

}


