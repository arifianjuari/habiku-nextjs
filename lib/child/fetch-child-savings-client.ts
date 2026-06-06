import { createClient } from "@/lib/supabase/client";
import { RPC } from "@/lib/database/rpc";
import type { ChildSavingsData } from "@/lib/savings/types";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { SavingsPocketRow } from "@/lib/savings/types";

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

async function enrichPockets(
  supabase: AppSupabaseClient,
  pockets: SavingsPocketRow[],
) {
  return Promise.all(
    pockets.map(async (pocket) => {
      const [balance, reserved] = await Promise.all([
        rpcNumber(supabase, RPC.computeSavingsPocketBalance, {
          p_pocket_id: pocket.id,
        }),
        rpcNumber(supabase, "compute_savings_reserved_balance", {
          p_pocket_id: pocket.id,
        }),
      ]);
      return { ...pocket, balance, reserved };
    }),
  );
}

export async function fetchChildSavingsDataClient(
  profileId: string,
  supabase?: AppSupabaseClient,
): Promise<ChildSavingsData> {
  const client = supabase ?? createClient();

  const { data: child, error: childError } = await client
    .from("child_profiles")
    .select("family_id")
    .eq("id", profileId)
    .maybeSingle();

  if (childError || !child?.family_id) {
    throw new Error("Profil anak tidak ditemukan.");
  }

  const [pocketsResult, settingsResult, walletBalance] = await Promise.all([
    client
      .from("savings_pockets")
      .select("*")
      .eq("profile_id", profileId)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    client
      .from("family_settings")
      .select("savings_enabled")
      .eq("family_id", child.family_id)
      .maybeSingle(),
    rpcNumber(client, RPC.computeWalletBalance, { p_profile_id: profileId }),
  ]);

  const pockets = (pocketsResult.data ?? []) as SavingsPocketRow[];
  const enriched = await enrichPockets(client, pockets);

  return {
    pockets: enriched,
    walletBalance,
    savingsEnabled: settingsResult.data?.savings_enabled ?? true,
  };
}
