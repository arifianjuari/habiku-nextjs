"use client";

import { useMemo, useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import { Coins, RefreshCw, Settings2, TrendingDown, TrendingUp } from "lucide-react";
import type { ChildProfile } from "@/types/database";
import type { ParentGoldSavingsData } from "@/lib/gold/types";
import { formatGoldQuantity, energyForSellMilli } from "@/lib/gold/units";
import { MARKET_SPREAD_RATIO } from "@/lib/gold/market-price";
import {
  applyMarketGoldPricesAction,
  updateGoldPricesAction,
} from "@/app/parent/savings/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type ParentGoldSavingsSectionProps = {
  gold: ParentGoldSavingsData;
  children: ChildProfile[];
  activeChildId: string;
};

function formatTxDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ParentGoldSavingsSection({
  gold,
  children,
  activeChildId,
}: ParentGoldSavingsSectionProps) {
  const queryClient = useQueryClient();
  const [isSaving, startSave] = useTransition();
  const [isApplyingMarket, startApplyMarket] = useTransition();
  const serverKey = `${gold.prices.sellPriceEnergy}:${gold.prices.buyPriceEnergy}:${gold.goldFollowMarket}`;
  const [syncedKey, setSyncedKey] = useState(serverKey);
  const [sellPrice, setSellPrice] = useState(String(gold.prices.sellPriceEnergy));
  const [buyPrice, setBuyPrice] = useState(String(gold.prices.buyPriceEnergy));
  const [followMarket, setFollowMarket] = useState(gold.goldFollowMarket);
  const busy = isSaving || isApplyingMarket;
  const spreadPercent = Math.round(MARKET_SPREAD_RATIO * 100);

  if (syncedKey !== serverKey) {
    setSyncedKey(serverKey);
    setSellPrice(String(gold.prices.sellPriceEnergy));
    setBuyPrice(String(gold.prices.buyPriceEnergy));
    setFollowMarket(gold.goldFollowMarket);
  }

  const refreshGoldQueries = () => {
    void queryClient.invalidateQueries({ queryKey: ["parent", "savings"] });
    void queryClient.invalidateQueries({ queryKey: ["child"] });
  };

  const unitLabel = gold.prices.unitLabel;
  const activeChild = children.find((c) => c.id === activeChildId);
  const activeQuantityMilli = gold.holdingsByProfile[activeChildId] ?? 0;
  const estimatedSell = energyForSellMilli(activeQuantityMilli, gold.prices.buyPriceEnergy);

  const activeChildTransactions = useMemo(
    () => gold.transactions.filter((tx) => tx.profile_id === activeChildId).slice(0, 8),
    [gold.transactions, activeChildId],
  );

  const handleSavePrices = () => {
    const sell = Number(sellPrice);
    const buy = Number(buyPrice);
    if (!Number.isFinite(sell) || !Number.isFinite(buy) || sell < 1 || buy < 1) {
      toast.error("Harga wajib diisi (minimal 1 energi).");
      return;
    }
    if (buy >= sell) {
      toast.error("Harga beli harus lebih rendah dari harga jual.");
      return;
    }

    startSave(async () => {
      const res = await updateGoldPricesAction(sell, buy);
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      setFollowMarket(false);
      refreshGoldQueries();
      toast.success(
        followMarket
          ? "Harga emas keluarga diperbarui. Pembaruan otomatis dimatikan."
          : "Harga emas keluarga diperbarui.",
      );
    });
  };

  const handleApplyMarket = () => {
    startApplyMarket(async () => {
      const res = await applyMarketGoldPricesAction();
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      setSellPrice(String(res.sellPriceEnergy));
      setBuyPrice(String(res.buyPriceEnergy));
      setFollowMarket(true);
      refreshGoldQueries();
      toast.success(
        `Harga pasar dipakai. Jual ${res.sellPriceEnergy} · beli ${res.buyPriceEnergy} (acuan ${res.spotEnergy}).`,
      );
    });
  };

  if (!gold.goldSavingsEnabled) {
    return (
      <section className="space-y-2" aria-label="Tabung Emas">
        <h2 className="px-0.5 text-xs font-bold text-muted-foreground">Tabung Emas</h2>
        <Card className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/20">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-100 text-2xl">
              🪙
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-foreground">Tabung Emas nonaktif</p>
              <p className="max-w-xs text-xs text-muted-foreground text-pretty">
                Aktifkan fitur agar anak bisa beli dan jual emas virtual dengan energi.
              </p>
            </div>
            <Link
              href="/parent/settings/engagement"
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-amber-200 bg-white px-4 text-xs font-bold text-amber-900 shadow-sm transition-colors hover:bg-amber-50"
            >
              <Settings2 className="size-4" aria-hidden />
              Pengaturan Engagement
            </Link>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="space-y-3" aria-label="Tabung Emas">
      <div className="space-y-0.5 px-0.5">
        <h2 className="text-xs font-bold text-muted-foreground">Tabung Emas</h2>
        <p className="text-[10px] leading-snug text-muted-foreground text-pretty">
          Toko emas keluarga — anak ajukan beli/jual; Papa/Mama setujui dulu.
        </p>
      </div>

      <Card className="overflow-hidden rounded-2xl border-amber-200/80 bg-gradient-to-br from-amber-50 via-white to-orange-50/40 shadow-sm">
        <CardContent className="space-y-4 p-4">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Coins className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-bold text-amber-950">Harga emas keluarga</p>
              <p className="text-[10px] text-amber-900/70 text-pretty">
                Beli 1 {unitLabel} = harga jual · Jual 1 {unitLabel} = harga beli · mendukung pecahan
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="gold-sell-price" className="text-xs font-bold">
                Harga jual (anak beli)
              </Label>
              <div className="relative">
                <TrendingUp
                  className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-amber-600"
                  aria-hidden
                />
                <Input
                  id="gold-sell-price"
                  type="number"
                  min={2}
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)}
                  className="h-10 pl-8 tabular-nums"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">Energi / {unitLabel}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gold-buy-price" className="text-xs font-bold">
                Harga beli (anak jual)
              </Label>
              <div className="relative">
                <TrendingDown
                  className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-emerald-600"
                  aria-hidden
                />
                <Input
                  id="gold-buy-price"
                  type="number"
                  min={1}
                  value={buyPrice}
                  onChange={(e) => setBuyPrice(e.target.value)}
                  className="h-10 pl-8 tabular-nums"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">Energi / {unitLabel}</p>
            </div>
          </div>

          <p className="text-[10px] leading-snug text-amber-900/70 text-pretty">
            Harga pasar memakai acuan emas dunia (bukan Antam), 1 {unitLabel} = 1 gram.
            Energi = rupiah per gram dibagi 1.000. Harga jual {spreadPercent}% di atas acuan,
            harga beli {spreadPercent}% di bawah.
          </p>
          {followMarket ? (
            <p className="rounded-lg bg-amber-100/80 px-2.5 py-1.5 text-[10px] font-medium text-amber-950 text-pretty">
              Mengikuti harga pasar. Diperbarui otomatis sekali sehari (sekitar pukul 09.00 WIB).
              Simpan harga manual untuk berhenti.
            </p>
          ) : null}

          <div className="grid gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={handleApplyMarket}
              className="h-10 w-full rounded-xl border-amber-300 bg-white font-bold text-amber-950 hover:bg-amber-50"
            >
              <span className={cn("inline-flex", isApplyingMarket && "animate-spin")} aria-hidden>
                <RefreshCw className="size-4" />
              </span>
              {isApplyingMarket ? "Mengambil harga…" : "Pakai harga pasar"}
            </Button>
            <Button
              type="button"
              disabled={busy}
              onClick={handleSavePrices}
              className="h-10 w-full rounded-xl bg-amber-600 font-bold hover:bg-amber-700"
            >
              {isSaving ? "Menyimpan…" : "Simpan harga emas"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {activeChild ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-amber-100 bg-white px-3 py-2.5 shadow-sm">
            <p className="text-[10px] font-medium text-muted-foreground">
              Saldo {activeChild.name}
            </p>
            <p className="mt-1 font-heading text-lg font-black tabular-nums text-amber-800">
              {formatGoldQuantity(activeQuantityMilli, unitLabel, { maxDecimals: 3 })}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-white px-3 py-2.5 shadow-sm">
            <p className="text-[10px] font-medium text-muted-foreground">Estimasi jual</p>
            <p className="mt-1 font-heading text-lg font-black tabular-nums text-emerald-700">
              {estimatedSell}
              <span className="ml-1 text-xs font-bold text-muted-foreground">E</span>
            </p>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <h3 className="px-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Riwayat transaksi
        </h3>
        {activeChildTransactions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-amber-100 bg-white/60 px-4 py-6 text-center text-xs text-muted-foreground">
            Belum ada transaksi emas{activeChild ? ` untuk ${activeChild.name}` : ""}.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {activeChildTransactions.map((tx) => (
              <li
                key={tx.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-white px-3 py-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-bold text-foreground">
                    {tx.kind === "buy" ? "Beli emas" : "Jual emas"} ·{" "}
                    {formatGoldQuantity(tx.quantityMilli, unitLabel)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{formatTxDate(tx.created_at)}</p>
                </div>
                <p
                  className={cn(
                    "shrink-0 font-bold tabular-nums",
                    tx.kind === "buy" ? "text-amber-700" : "text-emerald-700",
                  )}
                >
                  {tx.kind === "buy" ? "-" : "+"}
                  {tx.energy_amount} E
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
