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
    return "Saldo kantong tidak cukup.";
  }
  if (message.includes("savings_disabled")) {
    return "Fitur tabungan dinonaktifkan di pengaturan keluarga.";
  }
  if (message.includes("interest_rate_too_high")) {
    return "Bunga melebihi batas maksimum 20% per bulan.";
  }
  if (message.includes("lock_months_required")) {
    return "Deposito membutuhkan durasi kunci (bulan).";
  }
  if (message.includes("term_pocket_full")) {
    return "Kantong deposito ini sudah berisi setoran.";
  }
  if (message.includes("pocket_locked")) {
    return "Kantong masih terkunci; penarikan belum bisa diajukan.";
  }
  if (message.includes("pocket_not_found")) {
    return "Kantong tabungan tidak ditemukan.";
  }
  if (message.includes("name_required")) {
    return "Nama kantong wajib diisi.";
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
  const pocketType = String(formData.get("pocketType") ?? "flexible");
  const monthlyInterestBps = Number(formData.get("monthlyInterestBps") ?? 0);
  const lockMonthsRaw = String(formData.get("lockMonths") ?? "");
  const lockMonths = lockMonthsRaw ? Number(lockMonthsRaw) : null;
  const lockBonusCoefficient = Number(formData.get("lockBonusCoefficient") ?? 1);
  const defaultForGoalSave = formData.get("defaultForGoalSave") === "on";

  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as {
    rpc: (
      n: string,
      a: Record<string, unknown>,
    ) => Promise<{ data: string | null; error: { message: string } | null }>;
  }).rpc(RPC.createSavingsPocketV2, {
    p_profile_id: profileId,
    p_name: name,
    p_pocket_type: pocketType,
    p_emoji: emoji,
    p_accent_color: accentColor,
    p_target_amount: targetAmount,
    p_monthly_interest_bps: monthlyInterestBps,
    p_lock_months: lockMonths,
    p_lock_bonus_coefficient: lockBonusCoefficient,
    p_default_for_goal_save: defaultForGoalSave,
  });

  if (error) return { error: mapRpcError(error.message) };

  revalidatePath("/parent/savings");
  revalidatePath("/child/savings");
  revalidatePath("/child/targets");
  return { ok: true as const, pocketId: data };
}

export async function updateSavingsPocketAction(formData: FormData) {
  const context = await getSessionContext();
  if (!context) return { error: "Sesi tidak valid." };

  const pocketId = String(formData.get("pocketId") ?? "");
  const name = String(formData.get("name") ?? "");
  const emoji = String(formData.get("emoji") ?? "🐷");
  const accentColor = String(formData.get("accentColor") ?? "#8B5CF6");
  const targetRaw = String(formData.get("targetAmount") ?? "");
  const targetAmount = targetRaw ? Number(targetRaw) : null;
  const pocketType = String(formData.get("pocketType") ?? "flexible");
  const monthlyInterestBps = Number(formData.get("monthlyInterestBps") ?? 0);
  const lockMonthsRaw = String(formData.get("lockMonths") ?? "");
  const lockMonths = lockMonthsRaw ? Number(lockMonthsRaw) : null;
  const lockBonusCoefficient = Number(formData.get("lockBonusCoefficient") ?? 1);
  const defaultForGoalSave = formData.get("defaultForGoalSave") === "on";

  const supabase = await createClient();
  const { error } = await (supabase as unknown as {
    rpc: (
      n: string,
      a: Record<string, unknown>,
    ) => Promise<{ error: { message: string } | null }>;
  }).rpc(RPC.updateSavingsPocketV2, {
    p_pocket_id: pocketId,
    p_name: name,
    p_pocket_type: pocketType,
    p_emoji: emoji,
    p_accent_color: accentColor,
    p_target_amount: targetAmount,
    p_monthly_interest_bps: monthlyInterestBps,
    p_lock_months: lockMonths,
    p_lock_bonus_coefficient: lockBonusCoefficient,
    p_default_for_goal_save: defaultForGoalSave,
  });

  if (error) return { error: mapRpcError(error.message) };

  revalidatePath("/parent/savings");
  revalidatePath("/child/savings");
  revalidatePath("/child/targets");
  return { ok: true as const };
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

export async function approveGoalClaimAction(requestId: string) {
  const context = await getSessionContext();
  if (!context) return { error: "Sesi tidak valid." };

  const supabase = await createClient();
  const { error } = await (supabase as unknown as {
    rpc: (n: string, a: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  }).rpc(RPC.approveGoalRewardRedeem, { p_request_id: requestId });

  if (error) return { error: mapRpcError(error.message) };

  revalidatePath("/parent/savings");
  revalidatePath("/child/targets");
  return { ok: true as const };
}

export async function rejectGoalClaimAction(requestId: string, reason: string) {
  const context = await getSessionContext();
  if (!context) return { error: "Sesi tidak valid." };

  const supabase = await createClient();
  const { error } = await (supabase as unknown as {
    rpc: (n: string, a: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  }).rpc(RPC.rejectGoalRewardRedeem, {
    p_request_id: requestId,
    p_reason: reason,
  });

  if (error) return { error: mapRpcError(error.message) };

  revalidatePath("/parent/savings");
  revalidatePath("/child/targets");
  return { ok: true as const };
}
