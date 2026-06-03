"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/get-session-context";
import { RPC } from "@/lib/database/rpc";

function mapRpcError(message: string): string {
  if (message.includes("insufficient_wallet")) {
    return "Energi di dompet tidak cukup.";
  }
  if (message.includes("insufficient_pocket")) {
    return "Saldo kantong tidak cukup.";
  }
  if (message.includes("savings_disabled")) {
    return "Fitur tabungan dinonaktifkan di pengaturan keluarga.";
  }
  return message || "Terjadi kesalahan.";
}

export async function createSavingsPocketAction(formData: FormData) {
  const context = await getSessionContext();
  if (!context) return { error: "Sesi tidak valid." };

  const profileId = String(formData.get("profileId") ?? "");
  const name = String(formData.get("name") ?? "");
  const emoji = String(formData.get("emoji") ?? "🐷");
  const accentColor = String(formData.get("accentColor") ?? "#8B5CF6");
  const targetRaw = String(formData.get("targetAmount") ?? "");
  const targetAmount = targetRaw ? Number(targetRaw) : null;

  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as {
    rpc: (
      n: string,
      a: Record<string, unknown>,
    ) => Promise<{ data: string | null; error: { message: string } | null }>;
  }).rpc(RPC.createSavingsPocket, {
    p_profile_id: profileId,
    p_name: name,
    p_emoji: emoji,
    p_accent_color: accentColor,
    p_target_amount: targetAmount,
  });

  if (error) return { error: mapRpcError(error.message) };

  revalidatePath("/parent/savings");
  revalidatePath("/child/savings");
  return { ok: true as const, pocketId: data };
}

export async function approveSavingsWithdrawAction(transactionId: string) {
  const context = await getSessionContext();
  if (!context) return { error: "Sesi tidak valid." };

  const supabase = await createClient();
  const { error } = await (supabase as unknown as {
    rpc: (n: string, a: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  }).rpc(RPC.approveSavingsWithdraw, { p_transaction_id: transactionId });

  if (error) return { error: mapRpcError(error.message) };

  revalidatePath("/parent/savings");
  revalidatePath("/parent/ledger");
  revalidatePath("/child/savings");
  revalidatePath("/child/home");
  return { ok: true as const };
}

export async function rejectSavingsWithdrawAction(
  transactionId: string,
  reason: string,
) {
  const context = await getSessionContext();
  if (!context) return { error: "Sesi tidak valid." };

  const supabase = await createClient();
  const { error } = await (supabase as unknown as {
    rpc: (n: string, a: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  }).rpc(RPC.rejectSavingsWithdraw, {
    p_transaction_id: transactionId,
    p_reason: reason,
  });

  if (error) return { error: mapRpcError(error.message) };

  revalidatePath("/parent/savings");
  revalidatePath("/child/savings");
  return { ok: true as const };
}
