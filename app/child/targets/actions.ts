"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { RPC } from "@/lib/database/rpc";

function mapRpcError(message: string): string {
  if (message.includes("goal_not_ready")) {
    return "Target belum siap untuk diklaim.";
  }
  if (message.includes("claim_already_pending")) {
    return "Permintaan cair hadiah sudah menunggu persetujuan.";
  }
  if (message.includes("pocket_not_found")) {
    return "Belum ada kantong tabungan. Minta Papa/Mama membuatnya dulu.";
  }
  if (message.includes("term_pocket_full")) {
    return "Kantong deposito sudah penuh. Pilih kantong lain.";
  }
  if (message.includes("goal_save_disabled")) {
    return "Opsi menabung dari target dinonaktifkan.";
  }
  return message || "Terjadi kesalahan.";
}

export async function requestGoalRewardRedeemAction(goalId: string) {
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as {
    rpc: (
      n: string,
      a: Record<string, unknown>,
    ) => Promise<{ data: string | null; error: { message: string } | null }>;
  }).rpc(RPC.requestGoalRewardRedeem, { p_goal_id: goalId });

  if (error) return { error: mapRpcError(error.message) };

  revalidatePath("/child/targets");
  revalidatePath("/parent/savings");
  return { ok: true as const, requestId: data };
}

export async function saveGoalHpToSavingsAction(goalId: string, pocketId?: string) {
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as {
    rpc: (
      n: string,
      a: Record<string, unknown>,
    ) => Promise<{ data: string | null; error: { message: string } | null }>;
  }).rpc(RPC.saveGoalHpToSavings, {
    p_goal_id: goalId,
    p_pocket_id: pocketId ?? null,
  });

  if (error) return { error: mapRpcError(error.message) };

  revalidatePath("/child/targets");
  revalidatePath("/child/savings");
  revalidatePath("/parent/savings");
  return { ok: true as const, transactionId: data };
}
