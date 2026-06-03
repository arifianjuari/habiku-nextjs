import { createClient } from "@/lib/supabase/server";
import { RPC } from "@/lib/database/rpc";
import type {
  ChildSavingsData,
  ParentSavingsData,
  SavingsPocketRow,
  SavingsPocketWithBalance,
  SavingsWithdrawPending,
} from "@/lib/savings/types";
import type { ChildProfile } from "@/types/database";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

async function rpcNumber(
  supabase: SupabaseServer,
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
  supabase: SupabaseServer,
  pockets: SavingsPocketRow[],
): Promise<SavingsPocketWithBalance[]> {
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

export async function fetchParentSavingsData(
  familyId: string,
): Promise<ParentSavingsData> {
  const supabase = await createClient();

  const [childrenResult, settingsResult] = await Promise.all([
    supabase
      .from("child_profiles")
      .select("*")
      .eq("family_id", familyId)
      .order("name"),
    supabase
      .from("family_settings")
      .select("savings_enabled")
      .eq("family_id", familyId)
      .maybeSingle(),
  ]);

  const children = (childrenResult.data ?? []) as ChildProfile[];
  const profileIds = children.map((c) => c.id);
  const savingsEnabled = settingsResult.data?.savings_enabled ?? true;

  if (profileIds.length === 0) {
    return {
      children: [],
      pocketsByProfile: {},
      walletByProfile: {},
      pendingWithdrawals: [],
      savingsEnabled,
    };
  }

  const [pocketsResult, pendingResult, ...walletResults] = await Promise.all([
    supabase
      .from("savings_pockets")
      .select("*")
      .in("profile_id", profileIds)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("savings_transactions")
      .select(
        "id, pocket_id, profile_id, amount, note, created_at, savings_pockets(name, emoji), child_profiles(name)",
      )
      .in("profile_id", profileIds)
      .eq("kind", "withdraw")
      .eq("withdraw_status", "pending")
      .order("created_at", { ascending: false }),
    ...profileIds.map((id) =>
      rpcNumber(supabase, RPC.computeWalletBalance, { p_profile_id: id }),
    ),
  ]);

  const pockets = (pocketsResult.data ?? []) as SavingsPocketRow[];
  const enriched = await enrichPockets(supabase, pockets);

  const pocketsByProfile = profileIds.reduce<Record<string, SavingsPocketWithBalance[]>>(
    (acc, id) => {
      acc[id] = enriched.filter((p) => p.profile_id === id);
      return acc;
    },
    {},
  );

  const walletByProfile = profileIds.reduce<Record<string, number>>((acc, id, i) => {
    acc[id] = walletResults[i] ?? 0;
    return acc;
  }, {});

  const pendingWithdrawals: SavingsWithdrawPending[] = (
    pendingResult.data ?? []
  ).map((row) => {
    const r = row as {
      id: string;
      pocket_id: string;
      profile_id: string;
      amount: number;
      note: string | null;
      created_at: string;
      savings_pockets: { name: string; emoji: string } | { name: string; emoji: string }[] | null;
      child_profiles: { name: string } | { name: string }[] | null;
    };
    const pocket = Array.isArray(r.savings_pockets)
      ? r.savings_pockets[0]
      : r.savings_pockets;
    const child = Array.isArray(r.child_profiles)
      ? r.child_profiles[0]
      : r.child_profiles;
    return {
      id: r.id,
      pocket_id: r.pocket_id,
      profile_id: r.profile_id,
      amount: r.amount,
      note: r.note,
      created_at: r.created_at,
      pocket_name: pocket?.name ?? "Kantong",
      pocket_emoji: pocket?.emoji ?? "🐷",
      child_name: child?.name ?? "Anak",
    };
  });

  return {
    children,
    pocketsByProfile,
    walletByProfile,
    pendingWithdrawals,
    savingsEnabled,
  };
}

export async function fetchChildSavingsData(
  profileId: string,
  familyId: string,
): Promise<ChildSavingsData> {
  const supabase = await createClient();

  const [pocketsResult, settingsResult, walletBalance] = await Promise.all([
    supabase
      .from("savings_pockets")
      .select("*")
      .eq("profile_id", profileId)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("family_settings")
      .select("savings_enabled")
      .eq("family_id", familyId)
      .maybeSingle(),
    rpcNumber(supabase, RPC.computeWalletBalance, { p_profile_id: profileId }),
  ]);

  const pockets = (pocketsResult.data ?? []) as SavingsPocketRow[];
  const enriched = await enrichPockets(supabase, pockets);

  return {
    pockets: enriched,
    walletBalance,
    savingsEnabled: settingsResult.data?.savings_enabled ?? true,
  };
}
