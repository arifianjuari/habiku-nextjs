"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/get-session-context";
import { RPC } from "@/lib/database/rpc";

function mapRpcError(message: string): string {
  if (message.includes("insufficient_goal_energy")) {
    return "Energi di target aktif tidak cukup.";
  }
  if (message.includes("insufficient_wallet")) {
    return "Energi di dompet tidak cukup.";
  }
  if (message.includes("insufficient_pocket")) {
    return "Saldo kantong tidak cukup (termasuk yang menunggu persetujuan).";
  }
  if (message.includes("savings_disabled")) {
    return "Fitur tabungan belum aktif.";
  }
  if (message.includes("pocket_locked")) {
    return "Kantong masih terkunci; belum bisa ditarik.";
  }
  if (message.includes("term_pocket_full")) {
    return "Kantong deposito sudah berisi setoran.";
  }
  return message || "Terjadi kesalahan.";
}

export async function depositToSavingsAction(pocketId: string, amount: number) {
  const context = await getSessionContext();
  if (!context) return { error: "Sesi tidak valid." };

  const supabase = await createClient();
  const { error } = await (supabase as unknown as {
    rpc: (n: string, a: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  }).rpc(RPC.depositToSavings, {
    p_pocket_id: pocketId,
    p_amount: amount,
  });

  if (error) return { error: mapRpcError(error.message) };

  revalidatePath("/child/savings");
  revalidatePath("/child/targets");
  revalidatePath("/child/home");
  revalidatePath("/parent/savings");
  revalidatePath("/parent/ledger");
  return { ok: true as const };
}

export async function requestSavingsWithdrawAction(
  pocketId: string,
  amount: number,
  note: string,
) {
  const context = await getSessionContext();
  if (!context) return { error: "Sesi tidak valid." };

  const supabase = await createClient();
  const { error } = await (supabase as unknown as {
    rpc: (n: string, a: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  }).rpc(RPC.requestSavingsWithdraw, {
    p_pocket_id: pocketId,
    p_amount: amount,
    p_note: note,
  });

  if (error) return { error: mapRpcError(error.message) };

  revalidatePath("/child/savings");
  revalidatePath("/parent/savings");
  return { ok: true as const };
}
