import { createClient } from "@/lib/supabase/client";
import { RPC } from "@/lib/database/rpc";
import { enrichPockets } from "@/lib/savings/enrich-pockets";
import {
  fetchChildGoldSavingsData,
  type FamilyGoldSettingsRow,
} from "@/lib/gold/fetch-gold";
import type { ChildSavingsData, SavingsPocketRow } from "@/lib/savings/types";
import type { AppSupabaseClient } from "@/lib/supabase/types";

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

export async function fetchChildSavingsDataClient(
  profileId: string,
  supabase?: AppSupabaseClient,
): Promise<ChildSavingsData> {
  const client = supabase ?? createClient();

  const [childResult, pocketsResult] = await Promise.all([
    client.from("child_profiles").select("family_id").eq("id", profileId).maybeSingle(),
    client
      .from("savings_pockets")
      .select("*")
      .eq("profile_id", profileId)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
  ]);

  if (childResult.error || !childResult.data?.family_id) {
    throw new Error("Profil anak tidak ditemukan.");
  }

  const familyId = childResult.data.family_id;
  const pockets = (pocketsResult.data ?? []) as SavingsPocketRow[];

  // Satu query family_settings dibagi ke fetch gold — hindari duplikat + waterfall.
  const settingsPromise = Promise.resolve(
    client
      .from("family_settings")
      .select(
        "savings_enabled, goal_save_enabled, gold_savings_enabled, gold_sell_price_energy, gold_buy_price_energy, gold_unit_label",
      )
      .eq("family_id", familyId)
      .maybeSingle(),
  );

  const [settingsResult, savableBalance, walletBalance, gold, enriched] = await Promise.all([
    settingsPromise,
    rpcNumber(client, RPC.computeSavableGoalEnergy, { p_profile_id: profileId }),
    rpcNumber(client, RPC.computeWalletBalance, { p_profile_id: profileId }),
    settingsPromise.then((res) =>
      fetchChildGoldSavingsData(
        client,
        profileId,
        familyId,
        (res.data ?? null) as FamilyGoldSettingsRow | null,
      ),
    ),
    enrichPockets(client, pockets),
  ]);

  return {
    pockets: enriched,
    savableBalance,
    walletBalance,
    savingsEnabled: settingsResult.data?.savings_enabled ?? true,
    goalSaveEnabled: settingsResult.data?.goal_save_enabled ?? true,
    gold,
  };
}
