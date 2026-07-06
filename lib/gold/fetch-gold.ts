import type { AppSupabaseClient } from "@/lib/supabase/types";
import { RPC } from "@/lib/database/rpc";
import { energyForSellMilli } from "@/lib/gold/units";
import { computeGoldPnlSnapshot, type GoldPnlSnapshot } from "@/lib/gold/pnl";
import type {
  ChildGoldSavingsData,
  GoldPrices,
  GoldTradePending,
  GoldTransactionRow,
  ParentGoldSavingsData,
} from "@/lib/gold/types";

type FamilyGoldSettingsRow = {
  gold_savings_enabled: boolean;
  gold_sell_price_energy: number;
  gold_buy_price_energy: number;
  gold_unit_label: string;
};

type GoldTransactionDbRow = {
  id: string;
  profile_id: string;
  kind: "buy" | "sell";
  quantity_milli: number;
  energy_amount: number;
  unit_price_energy: number;
  status?: "pending" | "approved" | "rejected";
  created_at: string;
  child_profiles: { name: string } | { name: string }[] | null;
};

function parseGoldSettings(row: FamilyGoldSettingsRow | null | undefined): GoldPrices & {
  goldSavingsEnabled: boolean;
} {
  return {
    goldSavingsEnabled: row?.gold_savings_enabled ?? false,
    sellPriceEnergy: row?.gold_sell_price_energy ?? 20,
    buyPriceEnergy: row?.gold_buy_price_energy ?? 18,
    unitLabel: row?.gold_unit_label ?? "butir",
  };
}

function emptyChildPnl(
  quantityMilli: number,
  buyPriceEnergy: number,
  sellPriceEnergy: number,
): GoldPnlSnapshot {
  const marketValueEnergy = energyForSellMilli(quantityMilli, buyPriceEnergy);
  return {
    costBasisEnergy: 0,
    marketValueEnergy,
    unrealizedPnlEnergy: marketValueEnergy,
    unrealizedPnlPercent: null,
    avgBuyPricePerUnit: null,
    currentBuyPriceEnergy: buyPriceEnergy,
    currentSellPriceEnergy: sellPriceEnergy,
    priceVsAvgPercent: null,
    history: [],
  };
}

async function rpcNumber(
  supabase: AppSupabaseClient,
  fn: string,
  args: Record<string, unknown>,
): Promise<number> {
  const { data, error } = await (supabase as unknown as {
    rpc: (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  }).rpc(fn, args);

  if (error || typeof data !== "number") return 0;
  return data;
}

function childNameFromJoin(
  child: GoldTransactionDbRow["child_profiles"],
): string | undefined {
  const row = Array.isArray(child) ? child[0] : child;
  return row?.name;
}

function mapGoldTransactions(rows: GoldTransactionDbRow[]): GoldTransactionRow[] {
  return rows.map((row) => ({
    id: row.id,
    profile_id: row.profile_id,
    kind: row.kind,
    quantityMilli: row.quantity_milli,
    energy_amount: row.energy_amount,
    unit_price_energy: row.unit_price_energy,
    status: row.status ?? "approved",
    created_at: row.created_at,
    child_name: childNameFromJoin(row.child_profiles),
  }));
}

function mapPendingGoldTrades(rows: GoldTransactionDbRow[]): GoldTradePending[] {
  return rows.map((row) => ({
    id: row.id,
    profile_id: row.profile_id,
    kind: row.kind,
    quantityMilli: row.quantity_milli,
    energy_amount: row.energy_amount,
    child_name: childNameFromJoin(row.child_profiles) ?? "Anak",
    created_at: row.created_at,
  }));
}

export async function fetchParentGoldSavingsData(
  supabase: AppSupabaseClient,
  familyId: string,
  profileIds: string[],
  settingsRow: FamilyGoldSettingsRow | null | undefined,
): Promise<ParentGoldSavingsData> {
  const settings = parseGoldSettings(settingsRow);

  const empty: ParentGoldSavingsData = {
    goldSavingsEnabled: settings.goldSavingsEnabled,
    prices: {
      sellPriceEnergy: settings.sellPriceEnergy,
      buyPriceEnergy: settings.buyPriceEnergy,
      unitLabel: settings.unitLabel,
    },
    holdingsByProfile: Object.fromEntries(profileIds.map((id) => [id, 0])),
    pendingTrades: [],
    transactions: [],
  };

  if (profileIds.length === 0 || !settings.goldSavingsEnabled) return empty;

  const [holdingsResult, pendingResult, transactionsResult] = await Promise.all([
    supabase
      .from("gold_holdings")
      .select("profile_id, quantity_milli")
      .in("profile_id", profileIds),
    supabase
      .from("gold_transactions")
      .select(
        "id, profile_id, kind, quantity_milli, energy_amount, unit_price_energy, status, created_at, child_profiles(name)",
      )
      .in("profile_id", profileIds)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("gold_transactions")
      .select(
        "id, profile_id, kind, quantity_milli, energy_amount, unit_price_energy, status, created_at, child_profiles(name)",
      )
      .in("profile_id", profileIds)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const holdingsByProfile = { ...empty.holdingsByProfile };
  for (const row of (holdingsResult.data ?? []) as {
    profile_id: string;
    quantity_milli: number;
  }[]) {
    holdingsByProfile[row.profile_id] = row.quantity_milli;
  }

  return {
    goldSavingsEnabled: settings.goldSavingsEnabled,
    prices: empty.prices,
    holdingsByProfile,
    pendingTrades: mapPendingGoldTrades((pendingResult.data ?? []) as GoldTransactionDbRow[]),
    transactions: mapGoldTransactions((transactionsResult.data ?? []) as GoldTransactionDbRow[]),
  };
}

/** PnL emas anak — dimuat lazy di panel grafik agar tab tabungan tidak menunggu 100+ riwayat transaksi. */
export async function fetchChildGoldPnlSnapshot(
  supabase: AppSupabaseClient,
  profileId: string,
  quantityMilli: number,
  buyPriceEnergy: number,
  sellPriceEnergy: number,
): Promise<GoldPnlSnapshot> {
  const { data } = await supabase
    .from("gold_transactions")
    .select(
      "id, profile_id, kind, quantity_milli, energy_amount, unit_price_energy, status, created_at, child_profiles(name)",
    )
    .eq("profile_id", profileId)
    .eq("status", "approved")
    .order("created_at", { ascending: true })
    .limit(100);

  const pnlHistory = mapGoldTransactions((data ?? []) as GoldTransactionDbRow[]);
  return computeGoldPnlSnapshot(pnlHistory, quantityMilli, buyPriceEnergy, sellPriceEnergy);
}

export async function fetchChildGoldSavingsData(
  supabase: AppSupabaseClient,
  profileId: string,
  familyId: string,
): Promise<ChildGoldSavingsData> {
  const settingsResult = await supabase
    .from("family_settings")
    .select(
      "gold_savings_enabled, gold_sell_price_energy, gold_buy_price_energy, gold_unit_label",
    )
    .eq("family_id", familyId)
    .maybeSingle();

  const settings = parseGoldSettings(
    settingsResult.data as FamilyGoldSettingsRow | null | undefined,
  );

  const prices = {
    sellPriceEnergy: settings.sellPriceEnergy,
    buyPriceEnergy: settings.buyPriceEnergy,
    unitLabel: settings.unitLabel,
  };

  if (!settings.goldSavingsEnabled) {
    return {
      goldSavingsEnabled: false,
      prices,
      quantityMilli: 0,
      reservedSellMilli: 0,
      pendingBuyEnergy: 0,
      estimatedSellEnergy: 0,
      pendingTrades: [],
      transactions: [],
      pnl: emptyChildPnl(0, settings.buyPriceEnergy, settings.sellPriceEnergy),
    };
  }

  const [
    quantityMilli,
    reservedSellMilli,
    pendingBuyEnergy,
    pendingResult,
    transactionsResult,
  ] = await Promise.all([
    rpcNumber(supabase, RPC.computeGoldBalance, { p_profile_id: profileId }),
    rpcNumber(supabase, RPC.computeGoldReservedSellMilli, { p_profile_id: profileId }),
    rpcNumber(supabase, RPC.computeGoldPendingBuyEnergy, { p_profile_id: profileId }),
    supabase
      .from("gold_transactions")
      .select(
        "id, profile_id, kind, quantity_milli, energy_amount, unit_price_energy, status, created_at, child_profiles(name)",
      )
      .eq("profile_id", profileId)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("gold_transactions")
      .select(
        "id, profile_id, kind, quantity_milli, energy_amount, unit_price_energy, status, created_at, child_profiles(name)",
      )
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const availableMilli = Math.max(quantityMilli - reservedSellMilli, 0);

  return {
    goldSavingsEnabled: settings.goldSavingsEnabled,
    prices,
    quantityMilli,
    reservedSellMilli,
    pendingBuyEnergy,
    estimatedSellEnergy: energyForSellMilli(availableMilli, settings.buyPriceEnergy),
    pendingTrades: mapPendingGoldTrades((pendingResult.data ?? []) as GoldTransactionDbRow[]),
    transactions: mapGoldTransactions((transactionsResult.data ?? []) as GoldTransactionDbRow[]),
    pnl: emptyChildPnl(quantityMilli, settings.buyPriceEnergy, settings.sellPriceEnergy),
  };
}
